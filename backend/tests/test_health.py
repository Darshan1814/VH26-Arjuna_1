"""Health endpoint tests."""


def test_health_check(client):
    """Health check should return 200 with status healthy."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "machine-troubleshooter-api"


def test_health_check_contains_version(client):
    """Health check should include version information."""
    response = client.get("/health")
    data = response.json()
    assert "version" in data
