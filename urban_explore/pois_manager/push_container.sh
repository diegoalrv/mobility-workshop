START=$(date +%s)
docker rmi diegoalrv/mobility-concepcion-workshop:latest > /dev/null 2>&1 || true
docker buildx build --platform linux/amd64,linux/arm64 -t diegoalrv/mobility-concepcion-workshop:latest --push . > /dev/null 2>&1
END=$(date +%s)
echo "Image pushed successfully"
echo "Elapsed time: $((END - START)) seconds"