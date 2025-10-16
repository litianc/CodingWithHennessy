# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains documentation for the **智能会议纪要 Agent** (Intelligent Meeting Minutes Agent), an AI-powered system designed to automate meeting transcription, participant identification, and minutes generation.

## Core System Architecture

The system consists of 8 main functional modules:

1. **Meeting Control Panel** - Recording management with status indicators
2. **Multi-tab Interface** - Real-time transcription, meeting minutes, AI interaction, email sending
3. **Real-time Transcription** - Whisper-based speech-to-text with speaker identification
4. **Meeting Minutes Generation** - AI-powered structured summary creation
5. **AI Interaction Module** - Chat-based minutes optimization using LLM APIs
6. **Email Sending Module** - Automated participant email generation and delivery
7. **Voiceprint & Knowledge Base Management** - Speaker recognition and terminology enhancement
8. **Agent Information Panel** - System component status display

## Technology Stack Integration

- **Speech Recognition**: Alibaba Cloud Speech Recognition Service
- **Voiceprint Recognition**: Alibaba Cloud Voiceprint Recognition
- **AI Processing**: DeepSeek V3.2 LLM for content analysis and optimization
- **Audio Processing**: 16kHz/16bit mono audio format
- **UI Framework**: Modern responsive card-based layout with blue-purple gradient theme

## Key Workflow Patterns

1. **Recording Flow**: Start Recording → Real-time Transcription → Stop Recording → Generate Minutes
2. **AI Enhancement**: Minutes Generation → Three-stage animation (thinking → search → generation) → AI Chat Optimization → Final Minutes
3. **Email Automation**: Voiceprint Recognition → Participant Email Extraction → Email Composition → Automated Sending

## File Structure

- `docs/index.md` - Complete system specification in Chinese covering all modules, UI requirements, and implementation guidelines

## Development Focus Areas

This appears to be a specification/design document repository. When implementing the actual system:

- Prioritize the multi-tab responsive interface design
- Implement real-time speech-to-text with speaker identification
- Focus on the AI-powered minutes generation workflow
- Ensure smooth integration between voice recognition and LLM processing
- Design for demonstration/Demo scenarios with polished animations and interactions
- 目前是在做Demo演示产品，程序内部的接口认证不需要做得太严格