# create EKS cluster with nodes
eksctl create cluster \
--name prod \
--region us-east-1 \
--version 1.14 \
--nodegroup-name standard-workers \
--node-type t2.micro \
--nodes 3 \
--nodes-min 1 \
--nodes-max 4 \
--ssh-access \
--ssh-public-key seb-udacity-dev \
--managed \
--asg-access

# deploy the metric server
DOWNLOAD_URL=$(curl -Ls "https://api.github.com/repos/kubernetes-sigs/metrics-server/releases/latest" | jq -r .tarball_url)
DOWNLOAD_VERSION=$(grep -o '[^/v]*$' <<< $DOWNLOAD_URL)
curl -Ls $DOWNLOAD_URL -o metrics-server-$DOWNLOAD_VERSION.tar.gz
mkdir metrics-server-$DOWNLOAD_VERSION
tar -xzf metrics-server-$DOWNLOAD_VERSION.tar.gz --directory metrics-server-$DOWNLOAD_VERSION --strip-components 1
kubectl apply -f metrics-server-$DOWNLOAD_VERSION/deploy/1.8+/
rm -Rf metrics-server-$DOWNLOAD_VERSION
rm metrics-server-$DOWNLOAD_VERSION.tar.gz 

# deploy kubernete web UI
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.0.0-beta8/aio/deploy/recommended.yaml
kubectl apply -f k8s/eks-admin-service-account.yml

# create secret namespace
kubectl kustomize k8s/kustomization.yml
kubectl create namespace octank
kubectl apply -f k8s/secret.yaml

# create environment variable namespace
kubectl create namespace env-config
kubectl apply -f k8s/env-configmap.yml
