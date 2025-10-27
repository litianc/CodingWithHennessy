#!/usr/bin/env python3
"""
Test FunASR WebSocket service
"""
import asyncio
import websockets
import json
import sys
import wave

async def test_funasr(audio_file):
    """Test FunASR WebSocket connection and recognition"""

    # WebSocket URL (using ws:// since we disabled SSL)
    url = "ws://localhost:10095"

    print(f"Connecting to FunASR at {url}...")

    try:
        async with websockets.connect(url) as websocket:
            print("✅ Connected to FunASR WebSocket server")

            # Read audio file
            print(f"Reading audio file: {audio_file}")
            with wave.open(audio_file, 'rb') as wf:
                # Get audio parameters
                channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                framerate = wf.getframerate()
                n_frames = wf.getnframes()

                print(f"Audio info: {channels} channels, {sample_width} bytes/sample, {framerate} Hz, {n_frames} frames")

                # Read audio data
                audio_data = wf.readframes(n_frames)

            # Send start message
            start_msg = {
                "mode": "offline",
                "chunk_size": [5, 10, 5],
                "chunk_interval": 10,
                "wav_name": "test",
                "is_speaking": True,
                "wav_format": "pcm",
                "audio_fs": framerate
            }

            print(f"Sending start message: {json.dumps(start_msg, indent=2)}")
            await websocket.send(json.dumps(start_msg))

            # Send audio data
            print(f"Sending audio data ({len(audio_data)} bytes)...")
            await websocket.send(audio_data)

            # Send end message
            end_msg = {
                "is_speaking": False
            }
            print(f"Sending end message: {json.dumps(end_msg)}")
            await websocket.send(json.dumps(end_msg))

            # Receive results
            print("\n📝 Waiting for recognition results...")
            results = []

            while True:
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=30.0)

                    # Try to parse as JSON
                    try:
                        result = json.loads(response)
                        print(f"\n✅ Received result:")
                        print(json.dumps(result, indent=2, ensure_ascii=False))
                        results.append(result)

                        # Check if this is the final result
                        if result.get('is_final', False):
                            print("\n✅ Received final result")
                            break

                    except json.JSONDecodeError:
                        print(f"Received non-JSON response: {response[:100]}...")

                except asyncio.TimeoutError:
                    print("⏱️  Timeout waiting for response")
                    break
                except websockets.exceptions.ConnectionClosed:
                    print("🔌 Connection closed")
                    break

            print(f"\n✅ Test completed. Received {len(results)} results.")

            # Extract and print transcription text
            if results:
                for i, result in enumerate(results):
                    if 'text' in result:
                        print(f"\nResult {i+1} text: {result['text']}")

            return results

    except websockets.exceptions.WebSocketException as e:
        print(f"❌ WebSocket error: {e}")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_funasr.py <audio_file.wav>")
        sys.exit(1)

    audio_file = sys.argv[1]

    # Run the test
    results = asyncio.run(test_funasr(audio_file))

    if results:
        print("\n✅ FunASR test successful!")
        sys.exit(0)
    else:
        print("\n❌ FunASR test failed")
        sys.exit(1)
