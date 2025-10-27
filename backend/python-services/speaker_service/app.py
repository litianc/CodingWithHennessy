"""
3D-Speaker 声纹识别服务 - FastAPI 应用

提供声纹注册、识别、说话人分割等功能的 REST API
"""
import os
import tempfile
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger

from .config import settings
from .speaker_model import get_speaker_model
from .utils import format_response, ensure_dir


# 配置日志
logger.add(
    settings.LOG_FILE or "logs/speaker_service.log",
    rotation="1 day",
    retention="7 days",
    level=settings.LOG_LEVEL
)


# 创建 FastAPI 应用
app = FastAPI(
    title="3D-Speaker 声纹识别服务",
    description="提供声纹注册、识别、说话人分割等功能",
    version="1.0.0"
)


# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 数据模型
class SpeakerInfo(BaseModel):
    """说话人信息"""
    speaker_id: str
    name: str
    user_id: Optional[str] = None
    email: Optional[str] = None
    created_at: str
    sample_count: int = 1


class MatchResult(BaseModel):
    """匹配结果"""
    speaker_id: str
    name: str
    user_id: Optional[str] = None
    email: Optional[str] = None
    similarity: float
    confidence: float
    is_match: bool


class DiarizationSegment(BaseModel):
    """说话人分割片段"""
    start_time: float
    end_time: float
    speaker_id: str
    confidence: float


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    version: str
    model_loaded: bool
    registered_speakers: int


# 启动事件
@app.on_event("startup")
async def startup_event():
    """服务启动时初始化"""
    logger.info("=== 3D-Speaker 服务启动 ===")
    logger.info(f"Host: {settings.HOST}")
    logger.info(f"Port: {settings.PORT}")
    logger.info(f"Device: {settings.DEVICE}")
    logger.info(f"Model: {settings.SPEAKER_MODEL}")

    # 确保必要的目录存在
    ensure_dir(settings.MODEL_DIR)
    ensure_dir(settings.VOICEPRINT_DIR)
    ensure_dir("logs")

    # 初始化模型
    try:
        model = get_speaker_model()
        logger.info(f"模型初始化成功，已加载 {len(model.voiceprints)} 个声纹")
    except Exception as e:
        logger.error(f"模型初始化失败: {e}")


# API 路由

@app.get("/", tags=["System"])
async def root():
    """根路径"""
    return {
        "service": "3D-Speaker 声纹识别服务",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """健康检查"""
    try:
        model = get_speaker_model()
        return HealthResponse(
            status="ok",
            version="1.0.0",
            model_loaded=model.model is not None,
            registered_speakers=len(model.voiceprints)
        )
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        return HealthResponse(
            status="error",
            version="1.0.0",
            model_loaded=False,
            registered_speakers=0
        )


@app.post("/api/speaker/register", tags=["Speaker"])
async def register_speaker(
    name: str = Form(...),
    audio_files: List[UploadFile] = File(...),
    user_id: Optional[str] = Form(None),
    email: Optional[str] = Form(None)
):
    """
    注册声纹（支持多个音频样本）

    Args:
        name: 说话人姓名
        audio_files: 音频文件列表（建议3-10个）
        user_id: 用户ID（可选）
        email: 邮箱（可选）

    Returns:
        注册结果
    """
    try:
        logger.info(f"收到声纹注册请求: name={name}, samples={len(audio_files)}, user_id={user_id}")

        # 验证音频数量
        if len(audio_files) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="至少需要1个音频样本"
            )

        if len(audio_files) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="音频样本数量不能超过10个"
            )

        # 保存所有上传的音频文件
        temp_files = []
        try:
            for audio in audio_files:
                with tempfile.NamedTemporaryFile(
                    delete=False,
                    suffix=Path(audio.filename).suffix
                ) as temp_file:
                    content = await audio.read()
                    temp_file.write(content)
                    temp_files.append(temp_file.name)

            # 使用多个样本注册声纹
            model = get_speaker_model()

            if len(temp_files) == 1:
                # 单个样本：使用原有方法
                result = model.register_speaker(
                    name=name,
                    audio_path=temp_files[0],
                    user_id=user_id,
                    email=email
                )
            else:
                # 多个样本：使用批量注册方法
                result = model.register_speaker_batch(
                    name=name,
                    audio_paths=temp_files,
                    user_id=user_id,
                    email=email
                )

            logger.info(f"声纹注册成功: {result['speaker_id']}, samples={len(temp_files)}")

            return JSONResponse(
                content=format_response(
                    success=True,
                    message="声纹注册成功",
                    data=result
                )
            )

        finally:
            # 清理临时文件
            for temp_file in temp_files:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"声纹注册失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"声纹注册异常: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"声纹注册失败: {str(e)}"
        )


@app.post("/api/speaker/recognize", response_model=List[MatchResult], tags=["Speaker"])
async def recognize_speaker(
    audio: UploadFile = File(...),
    top_k: int = Form(5)
):
    """
    识别说话人

    Args:
        audio: 音频文件
        top_k: 返回前K个匹配结果

    Returns:
        匹配结果列表
    """
    try:
        logger.info(f"收到声纹识别请求: filename={audio.filename}")

        # 保存上传的音频文件到临时目录
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=Path(audio.filename).suffix
        ) as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            # 识别说话人
            model = get_speaker_model()
            matches = model.recognize_speaker(
                audio_path=temp_file_path,
                top_k=top_k
            )

            logger.info(f"声纹识别完成，找到 {len(matches)} 个匹配")

            return JSONResponse(
                content=format_response(
                    success=True,
                    message="声纹识别完成",
                    data={"matches": matches, "count": len(matches)}
                )
            )

        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    except ValueError as e:
        logger.warning(f"声纹识别失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"声纹识别异常: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"声纹识别失败: {str(e)}"
        )


@app.post("/api/speaker/diarization", response_model=List[DiarizationSegment], tags=["Speaker"])
async def diarization(
    audio: UploadFile = File(...),
    num_speakers: Optional[int] = Form(None)
):
    """
    说话人分割

    Args:
        audio: 音频文件
        num_speakers: 说话人数量（可选，None表示自动检测）

    Returns:
        分割结果列表
    """
    try:
        logger.info(f"收到说话人分割请求: filename={audio.filename}")

        # 保存上传的音频文件到临时目录
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=Path(audio.filename).suffix
        ) as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            # 说话人分割
            model = get_speaker_model()
            segments = model.diarization(
                audio_path=temp_file_path,
                num_speakers=num_speakers
            )

            logger.info(f"说话人分割完成，检测到 {len(segments)} 个片段")

            return JSONResponse(
                content=format_response(
                    success=True,
                    message="说话人分割完成",
                    data={"segments": segments, "count": len(segments)}
                )
            )

        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    except ValueError as e:
        logger.warning(f"说话人分割失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"说话人分割异常: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"说话人分割失败: {str(e)}"
        )


@app.get("/api/speaker/list", response_model=List[SpeakerInfo], tags=["Speaker"])
async def list_speakers():
    """
    获取所有已注册的说话人

    Returns:
        说话人列表
    """
    try:
        model = get_speaker_model()
        speakers = model.list_speakers()

        logger.info(f"查询说话人列表: {len(speakers)} 个")

        return JSONResponse(
            content=format_response(
                success=True,
                message="查询成功",
                data={"speakers": speakers, "count": len(speakers)}
            )
        )

    except Exception as e:
        logger.error(f"查询说话人列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询失败: {str(e)}"
        )


@app.delete("/api/speaker/{speaker_id}", tags=["Speaker"])
async def delete_speaker(speaker_id: str):
    """
    删除声纹

    Args:
        speaker_id: 声纹ID

    Returns:
        删除结果
    """
    try:
        logger.info(f"收到删除声纹请求: speaker_id={speaker_id}")

        model = get_speaker_model()
        success = model.delete_speaker(speaker_id)

        if success:
            logger.info(f"声纹删除成功: {speaker_id}")
            return JSONResponse(
                content=format_response(
                    success=True,
                    message="声纹删除成功"
                )
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="声纹不存在"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除声纹失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除失败: {str(e)}"
        )


# 错误处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理"""
    logger.error(f"未捕获的异常: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=format_response(
            success=False,
            message="服务器内部错误",
            error=str(exc)
        )
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=settings.WORKERS,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
