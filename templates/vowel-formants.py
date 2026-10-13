#!/usr/bin/env python3
# How the voice read a word with two sounds (docs/writing-for-the-ear.md,
# section 4): "live" the adverb (lyve) or the verb (liv), "read", "lead",
# "wind", "bow". A transcript cannot tell them apart; the vowel can.
#
#   python3 vowel-formants.py <word> <clip.mp3> [<clip.mp3>…]
#
# Needs ffmpeg, ElevenLabs Scribe (ELEVENLABS_API_KEY, for the word's
# timing) and praat-parselmouth (`pip install praat-parselmouth numpy`).
# For each clip it prints the first two formants at four points through
# the vowel (the /l/ onset and the /v/ coda skipped), so the reading can
# be compared with a clip whose reading is certain ("Live combat", "I
# live here"). Measured on ElevenLabs' James, multilingual v2:
#
#   lyve  F1 high and falling (650–780 → 300)   F2 rising (1000–1200 → 1600–2000)
#   liv   F1 low and flat (350–480)             F2 high and flat (1650–1900)
#
# Word length from the timings does not separate them (0.18 s and 0.20 s).
import json, os, subprocess, sys, urllib.request, uuid
import parselmouth

word, clips = sys.argv[1].lower(), sys.argv[2:]
KEY = os.environ.get("ELEVENLABS_API_KEY", "")


def timing(clip):
    """The word's start and end in the clip, from Scribe's word timings."""
    boundary = uuid.uuid4().hex
    body = b""
    for name, value in (("model_id", "scribe_v1"), ("timestamps_granularity", "word")):
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    body += f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="clip.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode()
    body += open(clip, "rb").read() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=body, headers={"xi-api-key": KEY, "Content-Type": f"multipart/form-data; boundary={boundary}"})
    for w in json.load(urllib.request.urlopen(req)).get("words", []):
        if w.get("type") == "word" and w["text"].lower().strip(".,!?") == word:
            return w["start"], w["end"]
    return None


for clip in clips:
    t = timing(clip)
    if not t:
        print(f'{clip}: no "{word}" heard')
        continue
    wav = clip + ".wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", clip, "-ac", "1", "-ar", "16000", wav], check=True)
    formant = parselmouth.Sound(wav).to_formant_burg(time_step=0.005, max_number_of_formants=5, maximum_formant=5000)
    os.remove(wav)
    start, end = t
    points = [start + (end - start) * f for f in (0.3, 0.45, 0.6, 0.75)]
    show = lambda n: " ".join(f"{formant.get_value_at_time(n, p):4.0f}" for p in points)
    print(f"F1 {show(1)} | F2 {show(2)} | {end - start:.2f}s | {os.path.basename(clip)}")
