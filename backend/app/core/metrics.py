"""Prometheus Metrics for Industrial Machine Troubleshooting System.

Tracks:
1. API request rate, duration, and status codes across all endpoints.
2. RAG pipeline stages (retrieval, reranking, LLM inference, citations).
3. Document processing and chunk indexing.
4. DevSecOps metrics (SonarQube quality score, Trivy vulnerability counts).
5. Kubernetes pod health status.
"""

try:
    from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

    class _DummyMetric:
        def __init__(self, *args, **kwargs):
            pass
        def labels(self, *args, **kwargs):
            return self
        def inc(self, *args, **kwargs):
            pass
        def dec(self, *args, **kwargs):
            pass
        def set(self, *args, **kwargs):
            pass
        def observe(self, *args, **kwargs):
            pass

    Counter = _DummyMetric
    Gauge = _DummyMetric
    Histogram = _DummyMetric

    def generate_latest():
        return b"# prometheus_client not installed\n"

    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4; charset=utf-8"


# =============================================================================
# 1. API & HTTP Metrics
# =============================================================================

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests received by endpoint and status code",
    ["method", "endpoint", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0],
)

ACTIVE_REQUESTS = Gauge(
    "http_active_requests",
    "Number of currently active in-flight HTTP requests",
)

# =============================================================================
# 2. RAG & AI Pipeline Metrics
# =============================================================================

TROUBLESHOOTING_QUERIES_TOTAL = Counter(
    "troubleshooting_queries_total",
    "Total troubleshooting requests processed",
    ["status", "machine_id"],
)

RAG_RETRIEVAL_DURATION_SECONDS = Histogram(
    "rag_retrieval_duration_seconds",
    "Time spent retrieving relevant chunks from vector / sqlite storage",
    buckets=[0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0],
)

LLM_INFERENCE_DURATION_SECONDS = Histogram(
    "llm_inference_duration_seconds",
    "Time spent in LLM generation via Groq inference engine",
    ["model"],
    buckets=[0.5, 1.0, 2.0, 3.0, 5.0, 8.0, 15.0, 30.0],
)

DOCUMENTS_PROCESSED_TOTAL = Counter(
    "documents_processed_total",
    "Total manual documents uploaded and processed",
    ["status", "file_type"],
)

DOCUMENT_CHUNKS_INDEXED_TOTAL = Counter(
    "document_chunks_indexed_total",
    "Total text/table chunks indexed into vector database",
)

# =============================================================================
# 3. DevSecOps & Security Metrics (SonarQube, Trivy, CI/CD)
# =============================================================================

SONARQUBE_QUALITY_GATE_STATUS = Gauge(
    "sonarqube_quality_gate_status",
    "SonarQube Quality Gate Status (1 = OK/Passed, 0 = Warn/Error)",
    ["project"],
)

TRIVY_VULNERABILITIES_COUNT = Gauge(
    "trivy_vulnerabilities_total",
    "Trivy vulnerability count by severity",
    ["target", "severity"],
)

PIPELINE_BUILD_STATUS = Gauge(
    "pipeline_build_status",
    "Jenkins CI/CD Pipeline build status (1 = Success, 0 = Failed)",
    ["pipeline", "stage"],
)

KUBERNETES_POD_HEALTH = Gauge(
    "kubernetes_pod_health_status",
    "Kubernetes Pod health check status (1 = Healthy, 0 = Degraded)",
    ["component"],
)
