#!/usr/bin/env python3
"""
Batch generate images using Gemini 2.0 Flash image generation.

Usage:
    python3 batch_generate.py "prompt text" -n 20 --ratio 1:1 -d output_dir -p logo
"""

import argparse
import os
import sys
import time

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate import generate_image


def batch_generate(prompt, count, output_dir, prefix, ratio="1:1"):
    os.makedirs(output_dir, exist_ok=True)

    success = 0
    failed = 0

    for i in range(1, count + 1):
        filename = f"{prefix}-{i:02d}.png"
        output_path = os.path.join(output_dir, filename)

        print(f"\n[{i}/{count}] Generating {filename}...")

        try:
            generate_image(prompt, output_path, ratio)
            success += 1
        except SystemExit:
            failed += 1
            print(f"Failed to generate {filename}")
        except Exception as e:
            failed += 1
            print(f"Error generating {filename}: {e}")

        # Rate limiting delay between requests
        if i < count:
            delay = 5
            print(f"Waiting {delay}s before next generation...")
            time.sleep(delay)

    print(f"\nBatch complete: {success} success, {failed} failed")
    print(f"Output directory: {output_dir}")
    return success


def main():
    parser = argparse.ArgumentParser(description='Batch generate images with Gemini')
    parser.add_argument('prompt', help='Image generation prompt')
    parser.add_argument('-n', '--count', type=int, default=20, help='Number of images (default: 20)')
    parser.add_argument('--ratio', default='1:1', help='Aspect ratio (default: 1:1)')
    parser.add_argument('-d', '--dir', default='.', help='Output directory')
    parser.add_argument('-p', '--prefix', default='image', help='Filename prefix')
    args = parser.parse_args()

    batch_generate(args.prompt, args.count, args.dir, args.prefix, args.ratio)


if __name__ == "__main__":
    main()
