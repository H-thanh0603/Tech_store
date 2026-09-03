"""Download real product photos from Wikimedia Commons to public/product-images/real/.

Usage: python3 scripts/download-real-product-images.py
Idempotent: skips files that already exist and look like valid images.
"""
import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "product-images", "real")

# slug -> candidate Commons File: titles (first reachable wins)
PRODUCTS = {
    "macbook-air-m3-1": [
        "Macbook Air 2020 (M1) - 1.jpg",
        "Macbook Air 2020 (M1) - 2.jpg",
    ],
    "macbook-air-m3-2": [
        "Macbook Air 2020 (M1) - 2.jpg",
        "Macbook Air 2020 (M1) - 1.jpg",
    ],
    "galaxy-s24-ultra": [
        "SAMSUNG Galaxy S24 Ultra (5).jpg",
        "Samsung S24 Ultra Phone.png",
        "Samsung Galaxy S24 (webtekno) 008.png",
    ],
    "tai-nghe": [
        "Pixel Buds Pro, orange.jpg",
        "Pixel Buds in charging case with product box.jpg",
    ],
    "galaxy-buds3-pro": [
        "Samsung Galaxy Z Flip 6 and Buds3.jpg",
        "Samsung Galaxy Buds2 Pro (Graphite) (3).jpg",
        "Samsung Galaxy Buds Live.jpg",
    ],
    "dell-xps-15": [
        "Dell XPS 15 (2017).png",
        "Dell XPS 15 (2015).png",
    ],
    "redmi-note-13": [
        "Xiaomi Redmi Note 10 Pro.jpg",
        "Redmi Note 8 front.jpg",
    ],
    "iphone-15": [
        "Back of iPhone 15.jpg",
        "IPhone 15 Blue.jpg",
    ],
    "rog-strix-g16": [
        "ROG Strix G16 2026-08-08 ASUS 03.jpg",
        "ROG Strix G16 2026-08-08 ASUS 01.jpg",
    ],
    "pc-proart": [
        "Falcon Northwest Tiki micro-tower desktop PC.png",
        "Ricer gaming PC with CPU watercooler.jpg",
    ],
    "tuf-vg27": [
        "Dual monitor setup in a gaming room with keyboard and mouse in focus.jpg",
        "TUF Gaming monitors, ROG computer cases, DaDa Wong standing on the main stage 20241222.jpg",
    ],
    "viewfinity-s8": [
        "Workspace setup with a computer monitor and desk lamp in an office environment.jpg",
        "Desk Setup (Unsplash).jpg",
    ],
    "jbl-flip-6": [
        "JBL Flip 4.jpg",
        "JBL Flip 3 bluetooth speaker (DSCF2653).jpg",
    ],
    "sony-wh-1000xm5": [
        "Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.jpg",
        "Sony, IFA 2018, Berlin (P1070257).jpg",
    ],
    "apple-watch-se": [
        "Apple Watch SE 2 (GPS + Cellular, 40mm, Midnight) with Anchor Blue Sport Loop.jpg",
        "Apple Watch SE 2 (GPS + Cellular, 40mm, Midnight) - Backside.jpg",
    ],
    "iphone-12-cu": [
        "IPhone 12 Pro Pacific Blue 256g.jpg",
        "IPhone 12 Blue.svg",
    ],
    "dell-latitude-cu": [
        "Dell Latitude E7470.jpg",
        "Dell Latitude 5410.jpg",
        "Dell Latitude D630.jpg",
    ],
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "TechStore-local-dev/1.0"})
    return urllib.request.urlopen(req, timeout=30)


def download(slug, titles):
    out = os.path.join(OUT_DIR, slug + ".jpg")
    if os.path.exists(out) and os.path.getsize(out) > 20_000:
        print(f"SKIP {slug} (exists)")
        return True
    for title in titles:
        url = (
            "https://commons.wikimedia.org/wiki/Special:FilePath/"
            + urllib.parse.quote(title)
            + "?width=1200"
        )
        try:
            with fetch(url) as resp:
                ctype = resp.headers.get("Content-Type", "")
                if not ctype.startswith("image/"):
                    print(f"  miss {title} ({ctype})")
                    continue
                data = resp.read()
                if len(data) < 20_000:
                    print(f"  miss {title} (too small: {len(data)}b)")
                    continue
                with open(out, "wb") as f:
                    f.write(data)
                print(f"OK {slug} <- {title} ({len(data)//1024}KB, {ctype})")
                return True
        except Exception as e:  # noqa: BLE001
            print(f"  miss {title} ({e})")
    print(f"FAIL {slug}")
    return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    ok, failed = 0, []
    for slug, titles in PRODUCTS.items():
        if download(slug, titles):
            ok += 1
        else:
            failed.append(slug)
    print(f"\n{ok}/{len(PRODUCTS)} downloaded")
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
