#!/usr/bin/env python3
"""
Utilitário mínimo chamado pelo Node (via child_process) para gerar um WAV
com o Piper. Mantido separado do piper_server.py porque aqui não precisamos
de um servidor sempre no ar — o processo Node já orquestra tudo, então só
chamamos o Piper sob demanda, uma vez por vídeo.
"""
import argparse
import sys
import wave

from piper import PiperVoice
from piper.config import SynthesisConfig


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--config", required=True)
    parser.add_argument("--length-scale", type=float, default=1.0)
    parser.add_argument("--output", required=True)
    parser.add_argument("--text", required=True)
    args = parser.parse_args()

    voice = PiperVoice.load(args.model, config_path=args.config)
    syn_config = SynthesisConfig(length_scale=args.length_scale)

    with wave.open(args.output, "wb") as wf:
        voice.synthesize_wav(args.text, wf, syn_config=syn_config)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERRO no piper_cli_helper: {e}", file=sys.stderr)
        sys.exit(1)
