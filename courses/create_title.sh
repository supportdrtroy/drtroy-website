#!/bin/bash

# Create title slide
cd /root/.openclaw/workspace/drtroy-website/courses

# Use ffmpeg to create a title video from the logo
ffmpeg -y -loop 1 -i images/drtroy_logo.png -i audio/module1_intro.wav \
  -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p \
  -shortest video/module1_intro.mp4 2>&1
