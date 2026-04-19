FROM ghcr.io/br3ndonland/inboard:fastapi-0.51-python3.11

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Use file.name* in case it doesn't exist in the repo
COPY ./app/ /app/
WORKDIR /app/
ENV HATCH_ENV_TYPE_VIRTUAL_PATH=.venv
ENV PIP_DEFAULT_TIMEOUT=100

RUN hatch env prune && hatch env create production && pip install --upgrade setuptools
# Install PyTorch CPU-only version first (faster and smaller)
RUN .venv/bin/pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN .venv/bin/pip install --no-deps -e .
RUN .venv/bin/pip install numpy scipy opencv-python-headless

# /start Project-specific dependencies
# RUN apt-get update && apt-get install -y --no-install-recommends \
#  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*	
# WORKDIR /app/
# /end Project-specific dependencies

# For development, Jupyter remote kernel
# Using inside the container:
# jupyter lab --ip=0.0.0.0 --allow-root --NotebookApp.custom_display_url=http://127.0.0.1:8888
ARG INSTALL_JUPYTER=false
RUN bash -c "if [ $INSTALL_JUPYTER == 'true' ] ; then pip install jupyterlab ; fi"

ARG BACKEND_APP_MODULE=app.main:app
ARG BACKEND_PRE_START_PATH=/app/prestart.sh
ARG BACKEND_PROCESS_MANAGER=gunicorn
ARG BACKEND_WITH_RELOAD=false
ENV APP_MODULE=${BACKEND_APP_MODULE} PRE_START_PATH=${BACKEND_PRE_START_PATH} PROCESS_MANAGER=${BACKEND_PROCESS_MANAGER} WITH_RELOAD=${BACKEND_WITH_RELOAD}