"""
CAOS-Mark Core Engine
=====================
Arnold's Cat Map + Discrete Cosine Transform (DCT-QIM) steganography.

Architecture:
  1. Text → bits (UTF-8, MSB first)
  2. Bits scrambled via Arnold's Cat Map (acts as secret key)
  3. Scrambled bits embedded into mid-frequency DCT coefficients of the
     Y-channel (luma) in YCrCb colour space using Quantization Index Modulation
  4. Extraction reverses the process using the same key (iteration count)
"""

import math

import cv2
import numpy as np

# ─────────────────────────────────────────────────────────────────────────────
# Bit-string utilities
# ─────────────────────────────────────────────────────────────────────────────

def _text_to_bits(text: str) -> list[int]:
    """UTF-8 text → flat list of bits (MSB first per byte)."""
    bits: list[int] = []
    for byte in text.encode("utf-8"):
        for i in range(7, -1, -1):
            bits.append((byte >> i) & 1)
    return bits


def _bits_to_text(bits: list[int]) -> str:
    """Flat list of bits → UTF-8 string (stops at null byte)."""
    chars: list[str] = []
    for i in range(0, len(bits) - 7, 8):
        byte = 0
        for b in bits[i : i + 8]:
            byte = (byte << 1) | b
        if byte == 0:
            break
        try:
            chars.append(byte.to_bytes(1, "big").decode("utf-8"))
        except UnicodeDecodeError:
            chars.append("?")
    return "".join(chars)


# ─────────────────────────────────────────────────────────────────────────────
# Arnold's Cat Map (vectorised via NumPy)
# ─────────────────────────────────────────────────────────────────────────────

def _next_square_size(n: int) -> int:
    """Smallest perfect-square count that fits n elements."""
    side = math.ceil(math.sqrt(n))
    return side * side


def _bits_to_square(bits: list[int], size: int) -> np.ndarray:
    """Pad bits to `size` elements and reshape to √size × √size int matrix."""
    side = int(math.sqrt(size))
    padded = bits + [0] * (size - len(bits))
    return np.array(padded, dtype=np.int32).reshape(side, side)


def _arnold_forward(mat: np.ndarray, iters: int) -> np.ndarray:
    """
    Apply Arnold's Cat Map forward for ``iters`` iterations.

    Mapping: (i, j) → ((i + j) % n,  (i + 2j) % n)
    Matrix:  [[1, 1], [1, 2]]  (det = 1, area-preserving)
    """
    n = mat.shape[0]
    result = mat.copy()
    r, c = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
    for _ in range(iters):
        tmp = np.empty_like(result)
        nr = (r + c) % n
        nc = (r + 2 * c) % n
        tmp[nr, nc] = result[r, c]
        result = tmp
    return result


def _arnold_inverse(mat: np.ndarray, iters: int) -> np.ndarray:
    """
    Apply the inverse Arnold's Cat Map for ``iters`` iterations.

    Inverse mapping: (i, j) → ((2i − j) % n,  (−i + j) % n)
    Inverse matrix:  [[2, −1], [−1, 1]]
    """
    n = mat.shape[0]
    result = mat.copy()
    r, c = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
    for _ in range(iters):
        tmp = np.empty_like(result)
        nr = (2 * r - c) % n
        nc = (-r + c) % n
        tmp[nr, nc] = result[r, c]
        result = tmp
    return result


def _scramble_bits(bits: list[int], iters: int) -> list[int]:
    """Scramble a flat bit list via Arnold's Cat Map."""
    size = _next_square_size(len(bits))
    mat = _bits_to_square(bits, size)
    return _arnold_forward(mat, iters).flatten().tolist()


def _unscramble_bits(bits: list[int], original_len: int, iters: int) -> list[int]:
    """Reverse the scrambling — must use the same `iters` as embed."""
    size = _next_square_size(original_len)
    paddeds = (bits + [0] * (size - len(bits)))[:size]
    side = int(math.sqrt(size))
    mat = np.array(paddeds, dtype=np.int32).reshape(side, side)
    return _arnold_inverse(mat, iters).flatten().tolist()[:original_len]


# ─────────────────────────────────────────────────────────────────────────────
# DCT coefficient positions (mid-frequency zigzag band of 8 × 8 block)
# ─────────────────────────────────────────────────────────────────────────────

_MID_FREQ: list[tuple[int, int]] = [
    (4, 4), (5, 3), (3, 5),
    (4, 3), (3, 4), (5, 4),
    (4, 5), (6, 2), (2, 6),
]


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def embed(
    image_bytes: bytes,
    text: str,
    *,
    iterations: int = 8,
    strength: float = 15.0,
) -> bytes:
    """
    Embed an invisible signature into an image.

    Parameters
    ----------
    image_bytes : bytes
        Source image (JPEG / PNG).
    text : str
        Signature string to hide.
    iterations : int
        Arnold's Cat Map iteration count (acts as the secret key).
    strength : float
        QIM quantisation step.  Higher → more robust but slightly more
        visible under aggressive JPEG re-compression.

    Returns
    -------
    bytes
        JPEG bytes of the watermarked image (quality = 95).

    Raises
    ------
    ValueError
        If the image cannot be decoded or is too small to hold the signature.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Cannot decode image — unsupported or corrupt format.")

    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    Y = ycrcb[:, :, 0].astype(np.float64)

    bits = _text_to_bits(text)
    scrambled = _scramble_bits(bits, iterations)

    h, w = Y.shape
    capacity = (h // 8) * (w // 8)
    if len(scrambled) > capacity:
        raise ValueError(
            f"Image too small: signature needs {len(scrambled)} 8×8 blocks "
            f"but image only has {capacity}."
        )

    idx = 0
    for row in range(h // 8):
        for col in range(w // 8):
            if idx >= len(scrambled):
                break
            r0, c0 = row * 8, col * 8
            block = Y[r0 : r0 + 8, c0 : c0 + 8]
            D = cv2.dct(block)

            fr, fc = _MID_FREQ[idx % len(_MID_FREQ)]
            coef = D[fr, fc]
            sign = float(np.sign(coef)) if coef != 0.0 else 1.0
            q = math.floor(abs(coef) / strength)
            residue = 0.75 if scrambled[idx] else 0.25
            D[fr, fc] = sign * (q + residue) * strength

            Y[r0 : r0 + 8, c0 : c0 + 8] = cv2.idct(D)
            idx += 1

    ycrcb[:, :, 0] = np.clip(Y, 0, 255).astype(np.uint8)
    out_bgr = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)

    ok, buf = cv2.imencode(".jpg", out_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
    if not ok:
        raise RuntimeError("Failed to JPEG-encode the watermarked image.")
    return buf.tobytes()


def extract(
    image_bytes: bytes,
    sig_len: int,
    *,
    iterations: int = 8,
    strength: float = 15.0,
) -> str:
    """
    Extract the hidden signature from a (possibly re-distributed) image.

    Parameters
    ----------
    image_bytes : bytes
        Suspect image bytes.
    sig_len : int
        Expected signature length **in characters** (must match embed call).
    iterations : int
        Arnold's Cat Map key (must match embed call).
    strength : float
        QIM step (must match embed call).

    Returns
    -------
    str
        Extracted signature string (may be garbled if image was heavily
        manipulated or key is wrong).
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Cannot decode suspect image.")

    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    Y = ycrcb[:, :, 0].astype(np.float64)

    n_raw_bits = sig_len * 8  # bits needed for the UTF-8 text
    n_scrambled = _next_square_size(n_raw_bits)  # padded square count

    h, w = Y.shape
    extracted: list[int] = []

    for row in range(h // 8):
        for col in range(w // 8):
            if len(extracted) >= n_scrambled:
                break
            r0, c0 = row * 8, col * 8
            block = Y[r0 : r0 + 8, c0 : c0 + 8]
            D = cv2.dct(block)

            fr, fc = _MID_FREQ[len(extracted) % len(_MID_FREQ)]
            rem = abs(D[fr, fc]) % strength
            extracted.append(1 if rem > strength * 0.5 else 0)

    # Pad in case the image had fewer blocks than expected
    extracted += [0] * (n_scrambled - len(extracted))

    unscrambled = _unscramble_bits(extracted, n_raw_bits, iterations)
    return _bits_to_text(unscrambled[:n_raw_bits])
