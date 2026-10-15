"""Authenticated transport only; service owns all school/resource authority."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from backend import diagnostic_models as models
from backend import diagnostic_service as service
from backend.authz import Identity, get_identity
from backend.db import get_connection
from backend.diagnostic_rules import DiagnosticRuleError

router = APIRouter(prefix="/v2/diagnostics", tags=["diagnostics"])
ResourceID = Annotated[int, Path(ge=1, le=2**63 - 1)]
Cursor = Annotated[int, Query(ge=0, le=2**63 - 1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


def _call(function, identity, *args):
    conn = get_connection()
    try:
        return function(conn, identity, *args)
    except service.DiagnosticError as exc:
        raise HTTPException(exc.status, exc.detail) from None
    except DiagnosticRuleError as exc:
        raise HTTPException(422, str(exc)) from None
    finally:
        conn.close()


@router.get("/blueprints", response_model=models.BlueprintList, response_model_exclude_unset=True)
def list_blueprints(identity: Identity = Depends(get_identity), after_id: Cursor = 0, limit: PageSize = 100):
    return _call(service.list_blueprints, identity, after_id, limit)


@router.post("/blueprints", response_model=models.Blueprint, status_code=201)
def create_blueprint(req: models.CreateBlueprint, identity: Identity = Depends(get_identity)):
    return _call(
        service.create_blueprint, identity, str(req.creation_key), req.title, req.class_level, req.subject
    )


@router.get("/blueprints/{blueprint_id}", response_model=models.Blueprint)
def read_blueprint(blueprint_id: ResourceID, identity: Identity = Depends(get_identity)):
    return _call(service.read_blueprint, identity, blueprint_id)


@router.put("/blueprints/{blueprint_id}", response_model=models.Blueprint)
def save_blueprint(
    blueprint_id: ResourceID, req: models.SaveBlueprint, identity: Identity = Depends(get_identity)
):
    return _call(
        service.save_blueprint, identity, blueprint_id, req.expected_revision, req.definition.model_dump()
    )


@router.get("/blueprints/{blueprint_id}/questions", response_model=models.Candidates)
def candidates(
    blueprint_id: ResourceID,
    identity: Identity = Depends(get_identity),
    after_id: Cursor = 0,
    limit: PageSize = 100,
):
    return _call(service.question_candidates, identity, blueprint_id, after_id, limit)


@router.post("/blueprints/{blueprint_id}/publish", response_model=models.Version, status_code=201)
def publish(blueprint_id: ResourceID, req: models.Revision, identity: Identity = Depends(get_identity)):
    return _call(service.publish_blueprint, identity, blueprint_id, req.expected_revision)


@router.post("/versions/{version_id}/withdraw", response_model=models.Version)
def withdraw(version_id: ResourceID, identity: Identity = Depends(get_identity)):
    return _call(service.withdraw_version, identity, version_id)


@router.post("/attempts", response_model=models.Attempt, status_code=201)
def start(req: models.StartAttempt, identity: Identity = Depends(get_identity)):
    return _call(service.start_attempt, identity, str(req.creation_key), req.version_id)


@router.get("/attempts/{attempt_id}", response_model=models.Attempt)
def read(attempt_id: UUID, identity: Identity = Depends(get_identity)):
    return _call(service.read_attempt, identity, str(attempt_id))


@router.post("/attempts/{attempt_id}/submission", response_model=models.Attempt)
def submit(attempt_id: UUID, req: models.Submission, identity: Identity = Depends(get_identity)):
    return _call(service.submit_attempt, identity, str(attempt_id), req.answers)
