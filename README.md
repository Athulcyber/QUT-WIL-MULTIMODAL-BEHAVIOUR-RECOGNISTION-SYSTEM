# QUT_WIL_MIT

Multi-modal Behavior Recognition in Healthcare Domain

## Development Setup

### Quick Start

Run the entire stack with:

```bash
git clone https://github.com/RenukaSharma/QUT_WIL_MIT.git
cd QUT_WIL_MIT
cd src
docker compose build
docker compose up -d

## Development URLs

- Front-end app: <http://localhost:3000/>  
- API Documentation (direct backend): <http://localhost:8888/docs>  
- Alternative API Docs: <http://localhost:8888/redoc>

In this repo the API is exposed on host port **8888** (see `src/docker-compose.override.yml`). **`http://localhost/docs` (port 80)** only works if Traefik successfully registers Docker routes; if that proxy is not routing, use the **:8888** URLs above.

## Local Development

- Make sure you have Python 3.11 or higher installed
- Use an IDE with Python support (VS Code recommended)
- Install required dependencies before running the application
