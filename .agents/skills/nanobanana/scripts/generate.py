#!/usr/bin/env python3
"""
Generate an image using Gemini 2.0 Flash image generation.

Usage:
    python3 generate.py "prompt text" --ratio 1:1 -o output.png
"""

import argparse
import base64
import os
import sys
import subprocess
import json


def get_api_key():
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        try:
            result = subprocess.run(
                ['grep', 'GEMINI_API_KEY', os.path.expanduser('~/.zshrc')],
                capture_output=True, text=True
            )
            if result.stdout:
                key = result.stdout.split('"')[1]
        except Exception:
            pass
    return key


def generate_image(prompt, output_path, ratio="1:1"):
    api_key = get_api_key()
    if not api_key:
        print("Error: GEMINI_API_KEY not found")
        sys.exit(1)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key={api_key}"

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"]
        }
    }

    payload_json = json.dumps(payload)

    cmd = [
        'curl', '-s', '-X', 'POST', url,
        '-H', 'Content-Type: application/json',
        '-d', payload_json
    ]

    print(f"Generating: {prompt[:80]}...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        sys.exit(1)

    try:
        response = json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Error: Invalid response: {result.stdout[:200]}")
        sys.exit(1)

    if 'error' in response:
        print(f"API Error: {response['error'].get('message', response['error'])}")
        sys.exit(1)

    candidates = response.get('candidates', [])
    if not candidates:
        print(f"Error: No candidates in response")
        sys.exit(1)

    parts = candidates[0].get('content', {}).get('parts', [])

    for part in parts:
        if 'inlineData' in part:
            mime_type = part['inlineData'].get('mimeType', '')
            if 'image' in mime_type:
                image_data = base64.b64decode(part['inlineData']['data'])
                os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
                with open(output_path, 'wb') as f:
                    f.write(image_data)
                print(f"Saved: {output_path} ({len(image_data) / 1024:.1f} KB)")
                return output_path

    print("Error: No image found in response")
    for part in parts:
        if 'text' in part:
            print(f"Text response: {part['text'][:200]}")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Generate image with Gemini')
    parser.add_argument('prompt', help='Image generation prompt')
    parser.add_argument('--ratio', default='1:1', help='Aspect ratio (default: 1:1)')
    parser.add_argument('-o', '--output', default='output.png', help='Output path')
    args = parser.parse_args()

    generate_image(args.prompt, args.output, args.ratio)


if __name__ == "__main__":
    main()
