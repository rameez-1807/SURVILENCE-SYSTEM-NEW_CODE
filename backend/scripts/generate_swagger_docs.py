"""
Generate Complete Swagger / OpenAPI Documentation
Exports:
1. backend/openapi.json (Standard OpenAPI 3.1 schema)
2. backend/swagger_ui.html (Standalone Interactive Swagger UI using CDN)
3. backend/SWAGGER_API_DOCS.md (Complete Markdown API Reference for all endpoints)
"""

import json
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

# Set environment
os.environ.setdefault("YOLO_CONFIG_DIR", "/tmp/Ultralytics")
os.environ.setdefault("MALLOC_ARENA_MAX", "2")

from app.main import app

def main():
    print("[1/3] Generating OpenAPI JSON Schema...")
    openapi_schema = app.openapi()
    
    # Save openapi.json in backend directory
    backend_dir = Path(__file__).resolve().parents[1]
    openapi_path = backend_dir / "openapi.json"
    with open(openapi_path, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2, ensure_ascii=False)
    print(f"Saved: {openapi_path}")

    # Save swagger_ui.html standalone viewer
    print("[2/3] Generating Standalone Swagger UI HTML...")
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{openapi_schema.get('info', {}).get('title', 'AI Surveillance API')} - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://fastapi.tiangolo.com/img/favicon.png" />
  <style>
    body {{
      margin: 0;
      padding: 0;
      background: #fafafa;
    }}
    .topbar {{
      display: none;
    }}
    .custom-header {{
      background: #0f172a;
      color: #fff;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }}
    .custom-header h1 {{
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .custom-header .badge {{
      background: #3b82f6;
      color: #fff;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-weight: 600;
    }}
    .custom-header .links {{
      font-size: 13px;
      display: flex;
      gap: 16px;
    }}
    .custom-header a {{
      color: #93c5fd;
      text-decoration: none;
    }}
    .custom-header a:hover {{
      text-decoration: underline;
    }}
  </style>
</head>
<body>
  <div class="custom-header">
    <h1>
      🛡️ {openapi_schema.get('info', {}).get('title', 'AI Surveillance System')}
      <span class="badge">v{openapi_schema.get('info', {}).get('version', '1.0.0')}</span>
    </h1>
    <div class="links">
      <span>Live Endpoint: <code>http://localhost:8000/docs</code></span>
      <span>EC2 Endpoint: <code>https://18.117.247.217/docs</code></span>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {{
      const spec = {json.dumps(openapi_schema, ensure_ascii=False)};
      window.ui = SwaggerUIBundle({{
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout"
      }});
    }};
  </script>
</body>
</html>
"""
    html_path = backend_dir / "swagger_ui.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Saved: {html_path}")

    # Generate Markdown documentation
    print("[3/3] Generating Comprehensive SWAGGER_API_DOCS.md...")
    md_lines = [
        f"# 🛡️ {openapi_schema.get('info', {}).get('title', 'AI Surveillance API')} — Swagger API Documentation",
        "",
        f"> **API Version**: `v{openapi_schema.get('info', {}).get('version', '1.0.0')}`  ",
        f"> **OpenAPI Version**: `{openapi_schema.get('openapi', '3.1.0')}`  ",
        f"> **Swagger UI Live Endpoint**: [`http://localhost:8000/docs`](http://localhost:8000/docs) (or on EC2: [`https://18.117.247.217/docs`](https://18.117.247.217/docs))  ",
        f"> **ReDoc Live Endpoint**: [`http://localhost:8000/redoc`](http://localhost:8000/redoc)  ",
        f"> **OpenAPI JSON Schema**: [`http://localhost:8000/openapi.json`](http://localhost:8000/openapi.json)  ",
        "",
        "---",
        "",
        "## 📑 Table of Contents (Endpoint Categories / Tags)",
        "",
    ]

    paths = openapi_schema.get("paths", {})
    
    # Group by tag
    tagged_endpoints = {}
    for path, methods in sorted(paths.items()):
        for method, details in sorted(methods.items()):
            if method.lower() not in ["get", "post", "put", "patch", "delete", "head", "options"]:
                continue
            tags = details.get("tags", ["General"])
            tag = tags[0] if tags else "General"
            if tag not in tagged_endpoints:
                tagged_endpoints[tag] = []
            tagged_endpoints[tag].append({
                "method": method.upper(),
                "path": path,
                "summary": details.get("summary", details.get("operationId", "")),
                "description": details.get("description", "").strip(),
                "parameters": details.get("parameters", []),
                "requestBody": details.get("requestBody", {}),
                "responses": details.get("responses", {}),
            })

    for tag in sorted(tagged_endpoints.keys()):
        anchor = tag.lower().replace(" ", "-").replace("/", "").replace("&", "")
        md_lines.append(f"- [📁 {tag}](#{anchor}) ({len(tagged_endpoints[tag])} endpoints)")
    
    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")

    # Detailed Endpoint Documentation
    total_endpoints = 0
    for tag in sorted(tagged_endpoints.keys()):
        md_lines.append(f"## 📁 {tag}")
        md_lines.append("")
        
        for ep in tagged_endpoints[tag]:
            total_endpoints += 1
            method_badge = {
                "GET": "🟢 `GET`",
                "POST": "🔵 `POST`",
                "PUT": "🟠 `PUT`",
                "PATCH": "🟣 `PATCH`",
                "DELETE": "🔴 `DELETE`",
            }.get(ep["method"], f"`{ep['method']}`")
            
            md_lines.append(f"### {method_badge} `{ep['path']}`")
            if ep["summary"]:
                md_lines.append(f"**Summary**: {ep['summary']}")
                md_lines.append("")
            if ep["description"]:
                md_lines.append(f"**Description**: {ep['description']}")
                md_lines.append("")

            # Parameters
            params = ep["parameters"]
            if params:
                md_lines.append("**Query / Path Parameters**:")
                md_lines.append("| Name | In | Required | Type | Description |")
                md_lines.append("|:---|:---:|:---:|:---:|:---|")
                for p in params:
                    p_name = p.get("name", "")
                    p_in = p.get("in", "")
                    p_req = "✅ Yes" if p.get("required", False) else "No"
                    p_schema = p.get("schema", {})
                    p_type = p_schema.get("type", p_schema.get("$ref", "string").split("/")[-1])
                    p_desc = p.get("description", "-")
                    md_lines.append(f"| `{p_name}` | `{p_in}` | {p_req} | `{p_type}` | {p_desc} |")
                md_lines.append("")

            # Request Body
            req_body = ep["requestBody"]
            if req_body:
                content = req_body.get("content", {})
                md_lines.append("**Request Body**:")
                for mime, mime_details in content.items():
                    schema_ref = mime_details.get("schema", {}).get("$ref", "")
                    schema_type = schema_ref.split("/")[-1] if schema_ref else mime_details.get("schema", {}).get("type", "object")
                    md_lines.append(f"- Content-Type: `{mime}` (Schema: `{schema_type}`)")
                md_lines.append("")

            # Responses
            responses = ep["responses"]
            if responses:
                md_lines.append("**Responses**:")
                md_lines.append("| Status Code | Description |")
                md_lines.append("|:---:|:---|")
                for code, res_det in responses.items():
                    desc = res_det.get("description", "Successful Response")
                    md_lines.append(f"| `{code}` | {desc} |")
                md_lines.append("")

            md_lines.append("---")
            md_lines.append("")

    docs_path = backend_dir / "SWAGGER_API_DOCS.md"
    with open(docs_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    print(f"Saved: {docs_path}")
    print(f"Total API operations documented: {total_endpoints}")

if __name__ == "__main__":
    main()
