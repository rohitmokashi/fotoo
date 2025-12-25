FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    git cmake make gcc g++ pkg-config \
    libde265-dev libx265-dev libaom-dev \
    libjpeg-dev libpng-dev \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Build latest libheif
RUN git clone https://github.com/strukturag/libheif.git && \
    cd libheif && \
    git checkout v1.20.1 && \
    mkdir build && cd build && \
    cmake .. && \
    make -j$(nproc) && \
    make install && \
    ldconfig

WORKDIR /work
ENTRYPOINT ["heif-convert"]
