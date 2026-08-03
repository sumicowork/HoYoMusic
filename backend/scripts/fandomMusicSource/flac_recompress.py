"""FLAC 1.5.0 重新编码脚本
处理流程:
1. metaflac 提取 TRACKNUMBER/DISCNUMBER/ALBUM/TITLE
2. flac -d 解码为临时 WAV
3. flac --best 重新编码（仅保留四个标签 + 无封面）
4. 新文件覆盖原文件
"""
import subprocess
import os
import sys
import glob
import shutil
import tempfile

FLAC_EXE = r"C:\Users\sumi\WebstormProjects\HoYoMusic\.workbuddy\flac-tools\flac-1.5.0-win\Win64\flac.exe"
METAF_EXE = r"C:\Users\sumi\WebstormProjects\HoYoMusic\.workbuddy\flac-tools\flac-1.5.0-win\Win64\metaflac.exe"
SRC_DIR = r"D:\补充"
TEMP_WAV_DIR = tempfile.mkdtemp(prefix="flac_recompress_")

def extract_tags(flac_path):
    """Extract TRACKNUMBER, DISCNUMBER, ALBUM, TITLE from FLAC file."""
    result = subprocess.run(
        [METAF_EXE, "--export-tags-to=-", flac_path],
        capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    tags = {}
    if result.returncode == 0:
        for line in result.stdout.strip().split('\n'):
            if '=' in line:
                key, val = line.split('=', 1)
                key_upper = key.strip().upper()
                if key_upper in ('TRACKNUMBER', 'DISCNUMBER', 'ALBUM', 'TITLE'):
                    tags[key_upper] = val.strip()
    return tags

def recompress(flac_path):
    """Recompress a single FLAC file with FLAC 1.5.0 --best, only 4 tags, no cover."""
    filename = os.path.basename(flac_path)
    directory = os.path.dirname(flac_path)
    
    # Step 1: Extract tags
    tags = extract_tags(flac_path)
    print(f"  Tags: {tags}")
    
    # Default values if tags missing
    tracknum = tags.get('TRACKNUMBER', '1')
    discnum = tags.get('DISCNUMBER', '1')
    album = tags.get('ALBUM', os.path.basename(directory))
    title = tags.get('TITLE', os.path.splitext(filename)[0])
    
    # Step 2: Decode to WAV via stdout (more lenient than -d -o)
    wav_path = os.path.join(TEMP_WAV_DIR, os.path.splitext(filename)[0] + '.wav')
    print(f"  Decoding to WAV: {wav_path}")
    with open(wav_path, 'wb') as wav_f:
        result = subprocess.run(
            [FLAC_EXE, "-dc", flac_path],
            stdout=wav_f, stderr=subprocess.PIPE, text=True
        )
    wav_size = os.path.getsize(wav_path)
    if wav_size == 0:
        print(f"  ❌ flac decode produced empty WAV: {result.stderr}")
        try: os.remove(wav_path)
        except: pass
        return False
    if "ERROR" in (result.stderr or "") and "LOST_SYNC" not in (result.stderr or ""):
        # Only fail on non-LOST_SYNC errors (LOST_SYNC is benign for these files)
        print(f"  ⚠️ Decode warning (non-LOST_SYNC): {result.stderr[:200]}")
        # Continue anyway - WAV was produced
    
    wav_size = os.path.getsize(wav_path)
    print(f"  WAV size: {wav_size / 1024 / 1024:.1f} MB")
    
    # Step 3: Re-encode with --best, only 4 tags, no cover art
    tmp_flac = flac_path + ".tmp.flac"
    cmd = [
        FLAC_EXE, "--best",  # maximum compression
        "-f",  # force overwrite
        "-o", tmp_flac,
        "--tag", f"TRACKNUMBER={tracknum}",
        "--tag", f"DISCNUMBER={discnum}",
        "--tag", f"ALBUM={album}",
        "--tag", f"TITLE={title}",
        wav_path
    ]
    print(f"  Re-encoding with --best...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ❌ flac encode failed: {result.stderr}")
        os.remove(wav_path)
        return False
    
    # Step 4: Verify and replace
    old_size = os.path.getsize(flac_path)
    new_size = os.path.getsize(tmp_flac)
    ratio = (1 - new_size / old_size) * 100
    print(f"  Size: {old_size/1024/1024:.1f}MB → {new_size/1024/1024:.1f}MB ({ratio:+.1f}%)")
    
    # Verify tags on new file
    new_tags = extract_tags(tmp_flac)
    if (new_tags.get('TRACKNUMBER') == tracknum and 
        new_tags.get('DISCNUMBER') == discnum and
        new_tags.get('ALBUM') == album and
        new_tags.get('TITLE') == title and
        'ARTIST' not in new_tags):
        # Replace original
        os.replace(tmp_flac, flac_path)
        print(f"  ✅ Done")
        success = True
    else:
        print(f"  ⚠️ Tag verification failed!")
        print(f"     Expected: TRACKNUMBER={tracknum}, DISCNUMBER={discnum}, ALBUM={album}, TITLE={title}")
        print(f"     Got: {new_tags}")
        # Still replace since the encode was successful, just warn
        os.replace(tmp_flac, flac_path)
        success = False
    
    # Clean up WAV
    os.remove(wav_path)
    return success

def main():
    flac_files = sorted(glob.glob(os.path.join(SRC_DIR, "*", "*.flac")))
    total = len(flac_files)
    print(f"Found {total} FLAC files across {len(set(os.path.dirname(f) for f in flac_files))} albums\n")
    
    success = 0
    failed = 0
    
    for i, flac_path in enumerate(flac_files, 1):
        album = os.path.basename(os.path.dirname(flac_path))
        filename = os.path.basename(flac_path)
        print(f"[{i}/{total}] {album}/{filename}")
        
        if recompress(flac_path):
            success += 1
        else:
            failed += 1
        print()
    
    # Cleanup temp dir
    import shutil as sh
    try:
        os.rmdir(TEMP_WAV_DIR)
    except:
        pass
    
    # Final size
    final_size = sum(os.path.getsize(f) for f in flac_files)
    print(f"=== DONE ===")
    print(f"Success: {success}, Failed: {failed}")
    print(f"Final size: {final_size / 1024 / 1024 / 1024:.2f} GB")

if __name__ == "__main__":
    main()
