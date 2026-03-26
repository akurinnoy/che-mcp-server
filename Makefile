IMAGE ?= quay.io/che-incubator/che-mcp-server
TAG ?= next

.PHONY: build image image-push

build:
	npm run build

image:
	docker buildx build --platform linux/amd64,linux/arm64 -t $(IMAGE):$(TAG) .

image-push:
	docker buildx build --platform linux/amd64,linux/arm64 -t $(IMAGE):$(TAG) --push .
