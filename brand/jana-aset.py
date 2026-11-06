#!/usr/bin/env python3
"""jana-aset.py: brand/logo.svg → brand/logo-512.png dan brand/logo-64.png (Chromium, Playwright), corak sama sasateguh/codr dan MyPII.

    uv run --with playwright==1.58.0 python3 brand/jana-aset.py
PNG dikomit kerana imej SVG dengan gradien tidak dipercayai semua pemapar README."""
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
svg = open(os.path.join(HERE, "logo.svg")).read()
with sync_playwright() as p:
    b = p.chromium.launch()
    for size in (512, 64):
        pg = b.new_page(viewport={"width": size, "height": size}, device_scale_factor=1)
        inner = svg.replace('width="256" height="256"', f'width="{size}" height="{size}"')
        pg.set_content(f'<html><body style="margin:0;background:transparent">{inner}</body></html>')
        pg.screenshot(path=os.path.join(HERE, f"logo-{size}.png"), omit_background=True)
    b.close()
