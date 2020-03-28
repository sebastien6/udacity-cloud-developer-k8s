# udacity-cloud-developer-k8s

## Prerequisite

Linux

install Helm
curl -sSL https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 | bash

verify install helm version --short

## AWS EKS

create an EKS cluster using the command line

eksctl create cluster \
--name prod \
--tags Owner=Sebastien,Project=Udacity Cloud Developer project3 \
--region us-east-1 \
--version 1.14 \
--nodegroup-name standard-workers \
--node-type t2.micro \
--nodes 3 \
--nodes-min 1 \
--nodes-max 4 \
--ssh-access \
--ssh-public-key k8-cluster-sev-dev.pem \
--managed \
--asg-access

create a file kustomization.yaml with the follwing parameters and add your own secret

namespace: octank
secretGenerator:
- name: database-credentials
  literals:
  - postgres_username= <USERNAME>
  - postgres_password= <PASSWORD>
  - jwt= <JWT_SECRET>

generatorOptions:
  disableNameSuffixHash: true

create a secret file
kubectl kustomize deployment/k8s/kustomization.yaml > secret.yaml

deploy this Secret to your EKS cluster.


kubectl create namespace octank
kubectl apply -f secret.yaml
