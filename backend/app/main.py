


from __future__ import annotations
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import SimulateRequest, SimulationResponse, OptimizeRequest
from .simulator import SimulationError, simulate_circuit
from .optimizer import optimize_circuit


app = FastAPI(
    title="Q-SQOOL API",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://q-sqool.netlify.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(SimulationError)
async def simulation_error_handler(
    request: Request,
    exc: SimulationError,
):
    error: dict[str, object] = {
    "code": exc.code,
    "message": exc.message,
}

    if exc.gate_id is not None:
        error["gateId"] = exc.gate_id

    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": error,
        },
    )


@app.get("/health")
async def health():
    return {
        "status": "online",
        "service": "Q-SQOOL API",
        "simulator": "qiskit_aer",
        "version": "0.1.0",
    }


@app.post(
    "/api/simulate",
    response_model=SimulationResponse,
)
async def simulate(request: SimulateRequest):
    return simulate_circuit(
        request.circuit,
        request.shots,
    )

@app.post("/api/optimize")
async def optimize(request: OptimizeRequest):
    return optimize_circuit(request.circuit)

