"""
FunASR 语音识别服务 API

提供HTTP接口用于语音识别
"""
import os
import time
import shutil
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger

from .config import settings
from .asr_model import get_asr_model
from .utils import ensure_dir, get_audio_duration


# 配置日志
log_dir = Path(settings.LOG_DIR)
ensure_dir(str(log_dir))

# 日志文件名包含日期
log_file = log_dir / f"funasr_service_{datetime.now().strftime('%Y%m%d')}.log"

logger.add(
    log_file,
    rotation="00:00",  # 每天午夜轮转
    retention="3 days",  # 保留3天
    level=settings.LOG_LEVEL,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}"
)

# 创建FastAPI应用
app = FastAPI(
    title=settings.SERVICE_NAME,
    version=settings.SERVICE_VERSION,
    description="基于FunASR的语音识别服务"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Demo环境允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 请求/响应模型
class RecognizeResponse(BaseModel):
    """识别响应"""
    success: bool
    text: Optional[str] = None
    duration: Optional[float] = None
    sample_rate: Optional[int] = None
    segments: Optional[list] = None
    timestamp: Optional[list] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    service: str
    version: str
    model: str
    timestamp: str


# 确保上传目录存在
ensure_dir(settings.UPLOAD_DIR)


@app.on_event("startup")
async def startup_event():
    """启动事件"""
    logger.info(f"启动 {settings.SERVICE_NAME} v{settings.SERVICE_VERSION}")
    logger.info(f"模型: {settings.ASR_MODEL}")
    logger.info(f"设备: {settings.DEVICE}")

    # 预加载模型
    try:
        model = get_asr_model()
        logger.info("模型预加载成功")
    except Exception as e:
        logger.error(f"模型预加载失败: {e}")


@app.get("/", response_model=dict)
async def root():
    """根路径"""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "status": "running"
    }


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """健康检查"""
    return HealthResponse(
        status="healthy",
        service=settings.SERVICE_NAME,
        version=settings.SERVICE_VERSION,
        model=settings.ASR_MODEL,
        timestamp=datetime.now().isoformat()
    )


@app.post("/api/recognize", response_model=RecognizeResponse)
async def recognize_speech(
    audio: UploadFile = File(..., description="音频文件"),
    enable_vad: Optional[bool] = Form(True, description="启用VAD（语音活动检测）"),
    enable_punc: Optional[bool] = Form(True, description="启用标点符号预测"),
    enable_timestamp: Optional[bool] = Form(True, description="生成时间戳")
):
    """
    语音识别

    接收音频文件，返回识别结果
    """
    temp_file = None

    try:
        logger.info(f"收到识别请求: {audio.filename}")

        # 验证文件类型
        if not audio.filename:
            raise HTTPException(status_code=400, detail="未提供文件名")

        # 检查文件大小
        audio.file.seek(0, 2)  # 移到文件末尾
        file_size = audio.file.tell()
        audio.file.seek(0)  # 回到文件开头

        if file_size > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"文件过大，最大支持 {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
            )

        # 保存临时文件
        timestamp = int(time.time() * 1000)
        temp_file = Path(settings.UPLOAD_DIR) / f"temp_{timestamp}_{audio.filename}"

        with open(temp_file, "wb") as f:
            shutil.copyfileobj(audio.file, f)

        logger.info(f"保存临时文件: {temp_file}")

        # 获取音频时长
        try:
            duration = get_audio_duration(str(temp_file))
            logger.info(f"音频时长: {duration:.2f}秒")
        except Exception as e:
            logger.warning(f"无法获取音频时长: {e}")

        # 调用ASR模型
        model = get_asr_model()
        result = model.recognize(
            str(temp_file),
            enable_vad=enable_vad,
            enable_punc=enable_punc,
            enable_timestamp=enable_timestamp
        )

        logger.info(f"识别成功: {result['text'][:50]}...")

        # 返回结果
        return RecognizeResponse(
            success=True,
            text=result['text'],
            duration=result.get('duration'),
            sample_rate=result.get('sample_rate'),
            segments=result.get('segments'),
            timestamp=result.get('timestamp')
        )

    except HTTPException as he:
        logger.error(f"HTTP异常: {he.detail}")
        raise he

    except ValueError as ve:
        logger.error(f"值错误: {ve}")
        return RecognizeResponse(
            success=False,
            error=str(ve)
        )

    except Exception as e:
        logger.error(f"识别失败: {e}", exc_info=True)
        return RecognizeResponse(
            success=False,
            error=f"语音识别失败: {str(e)}"
        )

    finally:
        # 清理临时文件
        if temp_file and temp_file.exists():
            try:
                temp_file.unlink()
                logger.debug(f"删除临时文件: {temp_file}")
            except Exception as e:
                logger.warning(f"删除临时文件失败: {e}")


@app.post("/api/recognize/batch")
async def recognize_batch(
    files: list[UploadFile] = File(..., description="音频文件列表"),
    enable_vad: Optional[bool] = Form(True),
    enable_punc: Optional[bool] = Form(True),
    enable_timestamp: Optional[bool] = Form(True)
):
    """
    批量语音识别

    接收多个音频文件，返回识别结果列表
    """
    results = []
    temp_files = []

    try:
        logger.info(f"收到批量识别请求: {len(files)} 个文件")

        # 保存所有临时文件
        for audio in files:
            timestamp = int(time.time() * 1000)
            temp_file = Path(settings.UPLOAD_DIR) / f"temp_{timestamp}_{audio.filename}"

            with open(temp_file, "wb") as f:
                shutil.copyfileobj(audio.file, f)

            temp_files.append(str(temp_file))

        # 批量识别
        model = get_asr_model()
        batch_results = model.recognize_batch(
            temp_files,
            enable_vad=enable_vad,
            enable_punc=enable_punc,
            enable_timestamp=enable_timestamp
        )

        return {
            "success": True,
            "total": len(files),
            "results": batch_results
        }

    except Exception as e:
        logger.error(f"批量识别失败: {e}", exc_info=True)
        return {
            "success": False,
            "error": f"批量识别失败: {str(e)}"
        }

    finally:
        # 清理所有临时文件
        for temp_file in temp_files:
            try:
                Path(temp_file).unlink()
            except Exception as e:
                logger.warning(f"删除临时文件失败: {e}")


@app.get("/api/info")
async def get_info():
    """获取服务信息"""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "model": settings.ASR_MODEL,
        "device": settings.DEVICE,
        "sample_rate": settings.SAMPLE_RATE,
        "max_upload_size": settings.MAX_UPLOAD_SIZE,
        "min_audio_length": settings.MIN_AUDIO_LENGTH,
        "max_audio_length": settings.MAX_AUDIO_LENGTH
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower()
    )
