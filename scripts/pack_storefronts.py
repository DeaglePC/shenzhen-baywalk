from pathlib import Path
from PIL import Image

brain = Path(r"C:\Users\dupen\.gemini\antigravity\brain\db807d96-953c-429d-b751-572f4c18a1bb")
img_a_path = brain / "shenzhen_houhai_storefronts_elevation_1795439286120.jpg"
img_b_path = brain / "shenzhen_houhai_storefronts_1795439285820.jpg"
out_path = Path(r"d:\my_git\bilibiliGame\shenzhen-bay\public\city\retail-fronts-sz.webp")

im_a = Image.open(img_a_path).convert("RGB")
im_b = Image.open(img_b_path).convert("RGB")

# Crop the thin upper header beam (~7.5% on A, ~5.2% on B) so both 4-bay strips align seamlessly at fascia top.
wa, ha = im_a.size
wb, hb = im_b.size
crop_a = im_a.crop((0, int(ha * 0.078), wa, int(ha * 0.992)))
crop_b = im_b.crop((0, int(hb * 0.052), wb, int(hb * 0.992)))

# Resize each 4-bay strip to 2048 x 680 -> combined 8-bay panorama 4096 x 680 (each bay ~512 x 680, crisp & proportional)
bay4_w, bay4_h = 2048, 680
res_a = crop_a.resize((bay4_w, bay4_h), Image.Resampling.LANCZOS)
res_b = crop_b.resize((bay4_w, bay4_h), Image.Resampling.LANCZOS)

atlas = Image.new("RGB", (bay4_w * 2, bay4_h))
atlas.paste(res_a, (0, 0))
atlas.paste(res_b, (bay4_w, 0))

out_path.parent.mkdir(parents=True, exist_ok=True)
atlas.save(out_path, "WEBP", quality=90, method=6)
print(f"Saved 8-bay Shenzhen storefront atlas: {out_path} ({atlas.size[0]}x{atlas.size[1]})")
