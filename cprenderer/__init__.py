from argparse import ArgumentParser, Namespace
from collections.abc import Sequence
from pathlib import Path
from typing import Optional

import pygame

from .loader import load_scene_from_file


class BaseCommand:
    description = None

    def add_arguments(self, parser: ArgumentParser) -> None:
        pass

    def run(self, args: Namespace) -> None:
        pass


class CommandCli(BaseCommand):
    name = "cli"
    description = "Command line interface"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            "--scene",
            type=Path,
            default="assets/cube/scene.usdc",
            help="Path to the scene file",
        )

    def run(self, args: Namespace) -> None:
        scene = load_scene_from_file(args.scene)
        print(scene)


class CommandGui(BaseCommand):
    name = "gui"
    description = "Graphical window interface"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            "--scene",
            type=Path,
            default="assets/cube/scene.usdc",
            help="Path to the scene file",
        )

    def run(self, args: Namespace) -> None:
        scene = load_scene_from_file(args.scene)

        pygame.init()
        pygame.display.set_mode(
            (1280, 720), flags=pygame.OPENGL | pygame.DOUBLEBUF, vsync=True
        )

        while True:
            for event in pygame.event.get():
                match event.type:
                    case pygame.QUIT:
                        pygame.quit()
                        return

            pygame.display.flip()


COMMANDS = [CommandCli(), CommandGui()]


def main(args: Optional[Sequence[str]] = None) -> None:
    parser = ArgumentParser(prog="cprenderer", description="CPRenderer")
    subparsers = parser.add_subparsers(dest="command", required=True)

    for command in COMMANDS:
        subparser = subparsers.add_parser(command.name, help=command.description)
        command.add_arguments(subparser)
        subparser.set_defaults(command=command)

    parsed_args = parser.parse_args(args)
    if command := parsed_args.command:
        delattr(parsed_args, "command")
        command.run(parsed_args)
    else:
        parser.print_help()
