import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.database import Base, get_db
from app.models.user import User

DATABASE_URL = "postgresql+asyncpg://wset_user:wset_pass@localhost:5432/wset_test"

engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSession() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    res = await client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "secret123",
        "wset_level": "L2",
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "dup@example.com",
        "password": "secret123",
        "wset_level": "L2",
    })
    res = await client.post("/api/auth/register", json={
        "email": "dup@example.com",
        "password": "secret123",
        "wset_level": "L2",
    })
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "login@example.com",
        "password": "secret123",
        "wset_level": "L3",
    })
    res = await client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "secret123",
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "wrong@example.com",
        "password": "secret123",
        "wset_level": "L1",
    })
    res = await client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpass",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_endpoint(client: AsyncClient):
    reg = await client.post("/api/auth/register", json={
        "email": "me@example.com",
        "password": "secret123",
        "wset_level": "L2",
    })
    token = reg.json()["access_token"]
    res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "me@example.com"
    assert data["wset_level"] == "L2"


@pytest.mark.asyncio
async def test_me_no_token(client: AsyncClient):
    res = await client.get("/api/auth/me")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_me_invalid_token(client: AsyncClient):
    res = await client.get("/api/auth/me", headers={"Authorization": "Bearer bad.token.here"})
    assert res.status_code == 401
