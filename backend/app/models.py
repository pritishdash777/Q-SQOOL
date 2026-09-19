from __future__ import annotations
from typing import Literal, Optional

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

    id: int = Field(strict=True)
    type: GateName
    qubit: int = Field(ge=0, strict=True)
    column: int = Field(ge=0, le=255, strict=True)
    target: Optional[int] = Field(default=None, ge=0, strict=True)
    angle: Optional[float] = Field(default=None, allow_inf_nan=False)


class Circuit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    qubits: int = Field(ge=1, le=5, strict=True)
    gates: list[CircuitGate] = Field(max_length=256)


class SimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    circuit: Circuit
    shots: int = Field(ge=1, le=4096, strict=True)
    simulator: Literal["qiskit_aer"] = "qiskit_aer"


class SimulationResponse(BaseModel):
    success: bool
    name: str = "Quantum circuit"
    simulator: str = "qiskit_aer"
    shots: Optional[int] = None
    counts: Optional[dict[str, int]] = None
    probabilities: Optional[dict[str, float]] = None
    executionMs: Optional[int] = None
    note: Optional[str] = None
    error: Optional[dict] = None


class OptimizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    circuit: Circuit
