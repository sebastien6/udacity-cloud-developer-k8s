# Udacity Cloud Developer Project 3 - Udagram Microservices

[![Build Status](https://travis-ci.org/joemccann/dillinger.svg?branch=master)](https://travis-ci.org/sebastien6/udacity-cloud-developer-k8s)

> the following documentation is based on Linux type shell operating system. For other operation system some command ajustement will be necessary.

The following instruction explain how to deploy the udagram application as a microservice using AWS EKS (AWS kubernete service), with a postgres database hosted as a AWS RDS service. The git repository is linked to a travis CI/CD pipeline. at new commit, the travis CI/CD pipeline is triggered.

The CI/CD pipeline will:
- rebuild new images using the docker-compose-build and the docker files of each microservice
- push the new images on my docker hub repository
- deploy the new images on the AWS EKS cluster

The RDS service for postgres is hosted on a VPC with no public access, and the EKS cluster is accessing the RDS instance using a VPC peering connection between its VPC and the RDS VPC.

# Table of Contents

1. [Prerequisite](#Prerequisite)
2. [RDS and EKS deployment](#RDS-and-EKS-deployment)
3. [Test deployment](#Test-deployment)
3. [Udagram microservice deployment](#Udagram-microservice-deployment)
4. [Cleanup](#cleanup)

## Prerequisite

### software
Install the following software on your computer if not already present

| Name | Link |
| ------ | ------ |
| AWS CLI v2 | https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-linux.html |
| AWS IAM AUthenticator | https://docs.aws.amazon.com/eks/latest/userguide/install-aws-iam-authenticator.html |
| Kubectl | https://docs.aws.amazon.com/eks/latest/userguide/install-kubectl.html |
| eksctl | https://docs.aws.amazon.com/eks/latest/userguide/eksctl.html |

### Configure AWS CLI
if not done yet, configure AWS command line with the command:
```sh
aws configure
```

### Set environment variables

set the following environment variables
```sh
export POSTGRES_USERNAME=<db_master_username>
export POSTGRES_PASSWORD=<db_master_password>
export POSTGRES_DB=<db_instance_name>
export AWS_REGION=<aws_region>
export EKS_CLUSTER_NAME=<aws_eks_cluster_name>
export EKS_TAGS="Owner=<your_name>,Project=<project_title>"
export EKS_KEY=<ec2_ssh_key_to_use_to_access_EKS_worker_nodes>
```

> Refer to AWS documentation on allowed characters for RDS instance name and EKS cluster name.

## RDS and EKS deployment

Open a terminal and run all the command in that terminal

### RDS Instance

Enter the following commands to setup an RDS instance

```sh
# Build a new VPC for RDS
RDS_VPC_ID=$(aws ec2 create-vpc --cidr-block 10.10.0.0/26 | jq '.Vpc.VpcId' | sed 's/"//g')
echo RDS_VPC_ID=$RDS_VPC_ID

# Capture new VPC route table ID
RDS_ROUTE_TABLE_ID=$(aws ec2 describe-route-tables --filters Name=vpc-id,Values=${RDS_VPC_ID} | jq '.RouteTables[0].RouteTableId' | sed 's/"//g')
echo RDS_ROUTE_TALE_ID=$RDS_ROUTE_TABLE_ID

# Create subnet for multiple zones
SUBNET_ID_US_EAST_1A=$(aws ec2 create-subnet --availability-zone "us-east-1a" --vpc-id ${RDS_VPC_ID} --cidr-block 10.10.0.0/28 | jq '.Subnet.SubnetId' | sed 's/"//g')
echo SUBNET_ID_US_EAST_1A=$SUBNET_ID_US_EAST_1A
SUBNET_ID_US_EAST_1B=$(aws ec2 create-subnet --availability-zone "us-east-1b" --vpc-id ${RDS_VPC_ID} --cidr-block 10.10.0.16/28 | jq '.Subnet.SubnetId' | sed 's/"//g')
echo SUBNET_ID_US_EAST_1B=$SUBNET_ID_US_EAST_1B
SUBNET_ID_US_EAST_1C=$(aws ec2 create-subnet --availability-zone "us-east-1c" --vpc-id ${RDS_VPC_ID} --cidr-block 10.10.0.32/28 | jq '.Subnet.SubnetId' | sed 's/"//g')
echo SUBNET_ID_US_EAST_1C=$SUBNET_ID_US_EAST_1C
SUBNET_ID_US_EAST_1D=$(aws ec2 create-subnet --availability-zone "us-east-1d" --vpc-id ${RDS_VPC_ID} --cidr-block 10.10.0.48/28 | jq '.Subnet.SubnetId' | sed 's/"//g')
echo SUBNET_ID_US_EAST_1D=$SUBNET_ID_US_EAST_1D

# associate subnets with route table
RT_ASSOCIATION_US_EAST_1=$(aws ec2 associate-route-table --route-table-id $RDS_ROUTE_TABLE_ID --subnet-id $SUBNET_ID_US_EAST_1A)
RT_ASSOCIATION_US_EAST_1B=$(aws ec2 associate-route-table --route-table-id $RDS_ROUTE_TABLE_ID --subnet-id $SUBNET_ID_US_EAST_1B)
RT_ASSOCIATION_US_EAST_1C=$(aws ec2 associate-route-table --route-table-id $RDS_ROUTE_TABLE_ID --subnet-id $SUBNET_ID_US_EAST_1C)
RT_ASSOCIATION_US_EAST_1D=$(aws ec2 associate-route-table --route-table-id $RDS_ROUTE_TABLE_ID --subnet-id $SUBNET_ID_US_EAST_1D)

# create a RDS subnet group
DB_SUBNET_GROUP_NAME=$(aws rds create-db-subnet-group --db-subnet-group-name  "UdagramPostgresDBSubnetGroup" --db-subnet-group-description "Udagram postgres DB Subnet Group" --subnet-ids $SUBNET_ID_US_EAST_1A $SUBNET_ID_US_EAST_1B $SUBNET_ID_US_EAST_1C $SUBNET_ID_US_EAST_1D | jq '.DBSubnetGroup.DBSubnetGroupName' | sed 's/"//g')
echo DB_SUBNET_GROUP_NAME=$DB_SUBNET_GROUP_NAME


# create a RDS VPC security group
RDS_VPC_SECURITY_GROUP_ID=$(aws ec2 create-security-group --group-name UdagramRDSSecurityGroup --description "Udagram RDS security group" --vpc-id ${RDS_VPC_ID} | jq '.GroupId' | sed 's/"//g')
echo RDS_VPC_SECURITY_GROUP_ID=$RDS_VPC_SECURITY_GROUP_ID


# create the RDS postgres instance
RDS_POSTGRES=$(aws rds create-db-instance \
  --db-name $POSTGRES_DB \
  --db-instance-identifier $POSTGRES_DB \
  --allocated-storage 20 \
  --db-instance-class db.t2.micro \
  --engine postgres \
  --engine-version "11.6" \
  --master-username $POSTGRES_USERNAME \
  --master-user-password $POSTGRES_PASSWORD \
  --no-publicly-accessible \
  --vpc-security-group-ids ${RDS_VPC_SECURITY_GROUP_ID} \
  --db-subnet-group-name $DB_SUBNET_GROUP_NAME \
  --port 5432)
echo $RDS_POSTGRES | jq
```

To check its creation status enter the command:

```sh
aws rds describe-db-instances --db-instance-identifier $POSTGRES_DB | jq '.DBInstances[0].DBInstanceStatus'
```

Wait until the result is returning "available" as result.

### AWS EKS
> to run the required components of Kubernete, with the required pods for the udagram application, a t3.medium ECS instance is required as a minium capacity of memory and CPU.

Enter the following commands in the same terminal as RDS to setup your EKS cluster

```sh
# create EKS cluster with nodes
eksctl create cluster \
    --name $EKS_CLUSTER_NAME \
    --tags "Owner=Sebastien,Project=Udacity Cloud Developer Project 3" \
    --region $AWS_REGION \
    --zones=us-east-1a,us-east-1b \
    --version 1.15 \
    --nodegroup-name udagram-workers \
    --node-type t3.medium \
    --nodes 1 \
    --nodes-min 1 \
    --nodes-max 3 \
    --ssh-access \
    --ssh-public-key $EKS_KEY \
    --managed \
    --asg-access
```

To check its creation status enter the command:

```sh
aws eks describe-cluster --name $EKS_CLUSTER_NAME | jq '.cluster.status'
```

Wait until the result is returning "ACTIVE" as result.

### VPC Peering connection
In the same terminal as previously, enter the follwing commands:

```sh
# Capture EKS VPC ID
EKS_VPC_ID=$(aws eks describe-cluster --name $EKS_CLUSTER_NAME | jq '.cluster.resourcesVpcConfig.vpcId' | sed 's/"//g')
echo EKS_VPC_ID=$EKS_VPC_ID

# Capture EKS routing table ID
EKS_ROUTE_TABLE_ID=$(aws ec2 describe-route-tables --filters Name="tag:aws:cloudformation:logical-id",Values="PublicRouteTable" | jq '.RouteTables[0].RouteTableId' | sed 's/"//g')
echo EKS_ROUTE_TABLE_ID=$EKS_ROUTE_TABLE_ID

# create VPC peering connection between RDS and EKS
VPC_PEERING_CONNECTION_ID=$(aws ec2 create-vpc-peering-connection --vpc-id ${EKS_VPC_ID}  --peer-vpc-id ${RDS_VPC_ID} | jq '.VpcPeeringConnection.VpcPeeringConnectionId' | sed 's/"//g')
echo VPC_PEERING_CONNECTION_ID=$VPC_PEERING_CONNECTION_ID
aws ec2 accept-vpc-peering-connection --vpc-peering-connection-id ${VPC_PEERING_CONNECTION_ID} | jq '.VpcPeeringConnection.Status.Code'
```
check its creation status with the command:
```sh
aws ec2 describe-vpc-peering-connections --vpc-peering-connection-id ${VPC_PEERING_CONNECTION_ID} | jq '.VpcPeeringConnections[0].Status.Code'
```

Wait until the result is returning "active" as result.
```sh
# Update EKS route table
aws ec2 create-route --route-table-id ${EKS_ROUTE_TABLE_ID} --destination-cidr-block 10.10.0.0/26 --vpc-peering-connection-id ${VPC_PEERING_CONNECTION_ID}

# Update RDS route table
aws ec2 create-route --route-table-id ${RDS_ROUTE_TABLE_ID} --destination-cidr-block 192.168.0.0/16 --vpc-peering-connection-id ${VPC_PEERING_CONNECTION_ID}

# Update RDS security group
aws ec2 authorize-security-group-ingress --group-id ${RDS_VPC_SECURITY_GROUP_ID} --protocol tcp --port 5432 --cidr 192.168.0.0/16
```

## Kubernete dashboard deployment
### update kubectl config
Enter the command to update the kubectl config with your new EKS cluster
```sh
aws eks --region $AWS_REGION update-kubeconfig --name $EKS_CLUSTER_NAME
```

### Metric server
Deploy the metric server
```sh
DOWNLOAD_URL=$(curl -Ls "https://api.github.com/repos/kubernetes-sigs/metrics-server/releases/latest" | jq -r .tarball_url)
DOWNLOAD_VERSION=$(grep -o '[^/v]*$' <<< $DOWNLOAD_URL)
curl -Ls $DOWNLOAD_URL -o metrics-server-$DOWNLOAD_VERSION.tar.gz
mkdir metrics-server-$DOWNLOAD_VERSION
tar -xzf metrics-server-$DOWNLOAD_VERSION.tar.gz --directory metrics-server-$DOWNLOAD_VERSION --strip-components 1
kubectl apply -f metrics-server-$DOWNLOAD_VERSION/deploy/1.8+/
```

Validate the deployment
```sh
kubectl get deployment metrics-server -n kube-system
```
returns something like,
```
NAME             DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
metrics-server   1         1         1            1           56m
```

### Deploy the dashboard
Enter the command
```sh
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.0.0-beta8/aio/deploy/recommended.yaml
```

Create an eks-admin Service Account and Cluster Role Binding
```sh
kubectl apply -f deployment/k8s/eks-admin-service-account.yml
```

### Connect to the dashboard
Open a separate terminal and enter the command
```sh
kubectrl proxy
```

go to http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/#!/login

Extract the authentication token with the following command
```sh
kubectl -n kube-system describe secret $(kubectl -n kube-system get secret | grep eks-admin | awk '{print $1}')
```

## Udagram microservice deployment

### Kubernete postgres service deployment
Enter the following command to capture the RDS endpoint address:
```sh
aws rds describe-db-instances --db-instance-identifier $POSTGRES_DB | jq '.DBInstances[0].Endpoint.Address'
```

Open the file deployment/k8s/portgres-service.yml and update the value externalName with the resulting value from the previous command for a result equivalent to:
```yaml
# RDS postgre service
apiVersion: v1
kind: Service
metadata:
  labels:
    app: postgres-service
  name: postgres-service
spec:
  externalName: udagramdev.cbf509ec2npp.us-east-1.rds.amazonaws.com 
  selector:
    app: postgres-service
  type: ExternalName
status:
  loadBalancer: {}
```

Deploy the postgres service to the EKS cluster
```sh
kubectl apply -f deployment/k8s/postgres-service.yml
```

test RDS connectivity from EKS pods. Run a temporary pod with the command
```sh
kubectl run -i --tty --rm debug --image=busybox --restart=Never -- sh
```

in the pod shell enter the command:
```sh
nc -zv postgres-service 5432
```

it shoud return a response equivalent to:
```
postgres-service (10.10.0.6:5432) open
```

Enter ```exit```, and the pod will close and be deleted.

### Create a project namespace
Enter the following command to create a project dedicated namespace. We will deploy the shared variables, secrets and microservice pods as part of that namespace.
```sh
kubectl create namespace udagram-p3
```

### EKS Secret deployment
create a file kustomization.yml with the following parameters and add your own database secrets to it.
```yaml
namespace: udagram-p3
secretGenerator:
- name: database-credentials
  literals:
  - postgres_username=<db_username>
  - postgres_password=<db_password>
generatorOptions:
  disableNameSuffixHash: true
```

enter the following command to generate the encrypted secret file
```sh
kubectl kustomize deployment/k8s/. > deployment/k8s/secret.yml
```

Deploy the secret to EKS cluster
```sh
kubectl apply -f deployment/k8s/secret.yml
```

### EKS shared variables deployment
open the file deployment/k8s/env-configmap.yml and enter the value for your environement in it.
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: env-config
  namespace: udagram-p3
  labels:
    app: udagram
data:
    POSTGRES_DB: <db_instance_name>
    POSTGRES_HOST: postgres-service 
    AWS_REGION: <AWS_REGION> 
    AWS_PROFILE: default 
    AWS_BUCKET: <UDAGRAM_AWS_BUCKET_NAME>
    JWT_SECRET: <JSON_WEB_TOKEN_SECRET>
    REVERSEPROXY_URL: http://<reverseproxy_service_name>:8080
    URL: http://localhost:8100
```

> the value of POSTGRES_HOST is postgres-service as defined previously in the postgres-service.yml file. all microservices will call the postgres-service to access the real endpoint address of the RDS service.

Deploy the shared variable to EKS cluster
```sh
kubectl apply -f deployment/k8s/env-configmap.yml
```

### Udagram deployment

Deploy api-feed
```sh
kubectl apply -f deployment/k8s/api-feed/deployment.yml
kubectl apply -f deployment/k8s/api-feed/service.yml
```

Deploy api-user
```sh
kubectl apply -f deployment/k8s/api-user/deployment.yml
kubectl apply -f deployment/k8s/api-user/service.yml
```

Deploy reverseproxy
```sh
kubectl apply -f deployment/k8s/reverseproxy/deployment.yml
kubectl apply -f deployment/k8s/reverseproxy/service.yml
kubectl apply -f deployment/k8s/reverseproxy/service-external.yml
```
> reverse proxy will resolved the service under the name reverseproxy on port 8080 internally and the service under the name api on port 8081 will have an external endpoint url.

Deploy frontend
```sh
kubectl apply -f deployment/k8s/frontend/deployment.yml
kubectl apply -f deployment/k8s/frontend/service.yml
```

## Test deployment
> after the deployment, it can take a couple of minutes before the external endpoint DNS name can be resolved on the internet.

List deployment
```sh
kubectl get deployment -n udagram
```
should returns something like this:
```
NAME               READY   UP-TO-DATE   AVAILABLE   AGE
api-feed           1/1     1            1           167m
api-image-filter   1/1     1            1           21m
api-user           1/1     1            1           166m
frontend           1/1     1            1           5m2s
reverseproxy       1/1     1            1           18m
```

List pods
```sh
kubectl get deployment -n udagram
```
should returns something like this:
```
NAME                                READY   STATUS    RESTARTS   AGE
api-feed-6f7ccddf78-646db           1/1     Running   0          166m
api-image-filter-8564f48bfd-6q9tw   1/1     Running   0          20m
api-user-55bcbb8fd9-t25t5           1/1     Running   0          165m
frontend-5f8b94f486-vg5dj           1/1     Running   0          4m55s
reverseproxy-bcdc787b4-qcjdr        1/1     Running   0          17m
```

List services
```sh
kubectl get service -n udagram
```
should returns something like this:
```
api-feed           ClusterIP      10.100.208.5     <none>                                                                    8080/TCP         166m
api-image-filter   ClusterIP      10.100.160.213   <none>                                                                    8080/TCP         19m
api-user           ClusterIP      10.100.78.96     <none>                                                                    8080/TCP         19m
frontend           LoadBalancer   10.100.85.130    a20549b44b66b477bbfe42d5e085e04f-1667707796.us-east-1.elb.amazonaws.com   80:31454/TCP     3m4s
postgres-service   ExternalName   <none>           udagram.cbf509ec2npp.us-east-1.rds.amazonaws.com                          <none>           169m
reverseproxy       LoadBalancer   10.100.94.40     aad91205157814a01b1f573e52d6e316-9876234.us-east-1.elb.amazonaws.com      8080:31203/TCP   16
```

Extract the API URL:
```sh
API=$(kubectl get service api -n udagram -o json | jq -r '.status.loadBalancer.ingress[].hostname')
```

Extract the frontend URL:
```sh
FRONTEND=$(kubectl get service frontend -n udagram -o json | jq -r '.status.loadBalancer.ingress[].hostname')
echo $FRONTEND
```

Test API call:
```sh
curl -m3 -v $API:8080/api/v0/feed
```
should return something like this with http code 200:
```
*   Trying 107.23.216.150...
* TCP_NODELAY set
* Connected to aad91205157814a01b1f573e52d6e316-9876234.us-east-1.elb.amazonaws.com (107.23.216.150) port 8080 (#0)
> GET /api/v0/feed HTTP/1.1
> Host: aad91205157814a01b1f573e52d6e316-9876234.us-east-1.elb.amazonaws.com:8080
> User-Agent: curl/7.58.0
> Accept: */*
> 
< HTTP/1.1 200 OK
< Server: nginx/1.17.10
< Date: Tue, 21 Apr 2020 16:37:46 GMT
< Content-Type: application/json; charset=utf-8
< Content-Length: 21
< Connection: keep-alive
< X-Powered-By: Express
< Access-Control-Allow-Origin: *
< Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization
< ETag: W/"15-vdbQeQQlK2hbke4QvAXZ1BGjGgU"
< 
* Connection #0 to host aad91205157814a01b1f573e52d6e316-9876234.us-east-1.elb.amazonaws.com left intact
```

Test frontend
```sh
curl -m3 -v $FRONTEND/
```
open a web browser and go the the frontend URL to enjoy the webapp.

## Update microservice without downtime and Blue/Green Deployment

To deploy two version of a microservice at the same time, current(blue) and updated(green). Open the deployment file of the microservice you'd like to update and increase it version number.

Commit the change, and push to github repository. The CI/CD pipeline will rebuild the image and update the deployment to run the two version at the same time. Traffic will keep going to the initial version.

Update the service file for the microservice to the targeted version, and commit again to start the pipeline. The CI/CD pipeline will send `kubectl apply` command to update the service, and traffic will be redirected to the new version (green).

To Rollback, change back the verion number in service.yml for the microservice to previous version number and re-trigger the pipeline.

All the update and rollback will occur without downtime.

## Cleanup
to avoid extra cost, delete your EKS cluster and RDS instance when done with it.

Delele the eks cluster, and wait for its deletion
```sh
eksctl delete cluster --name $EKS_CLUSTER_NAME
```

Delete the VPC peering connection
```sh
aws ec2 delete-vpc-peering-connection --vpc-peering-connection-id ${VPC_PEERING_CONNECTION_ID}
```

Delete RDS instance, and wait for its deletion
```sh
aws rds delete-db-instance --db-instance-identifier $POSTGRES_DB --skip-final-snapshot --delete-automated-backups
aws rds delete-db-subnet-group --db-subnet-group-name udagrampostgresdbsubnetgroup
```
