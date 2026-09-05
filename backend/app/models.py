from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


GateName = Literal[
    "X",
    "Y",
    "Z",
    "H",
    "S",
    "T",
    "RX",
    "RY",
    "RZ",
    "CX",
    "CZ",
    "M",
]


class CircuitGate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    type: GateName
    qubit: int = Field(ge=0)
    column: int = Field(ge=0)
    target: int | None = Field(default=None, ge=0)
    angle: float | None = None


class Circuit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    qubits: int = Field(ge=1, le=5)
    gates: list[CircuitGate]


class SimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    circuit: Circuit
    shots: int = Field(ge=1, le=4096)
    simulator: Literal["qiskit_aer"] = "qiskit_aer"


class SimulationResponse(BaseModel):
    success: bool
    name: str = "Quantum circuit"
    simulator: str = "qiskit_aer"
    shots: int | None = None
    counts: dict[str, int] | None = None
    probabilities: dict[str, float] | None = None
    executionMs: int | None = None
    note: str | None = None
    error: dict | None = None


class OptimizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    circuit: Circuit
