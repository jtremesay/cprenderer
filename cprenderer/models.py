from typing import Optional


class Mesh:
    def __init__(self, name: str):
        self.name = name

    def __repr__(self) -> str:
        return f"<Mesh name={self.name}>"


class Scene:
    def __init__(self, meshes: Optional[list[Mesh]] = None):
        self.meshes = meshes if meshes is not None else []

    def __repr__(self) -> str:
        return f"<Scene meshes={self.meshes}>"
