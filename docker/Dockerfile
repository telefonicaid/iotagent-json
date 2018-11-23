ARG NODE_VERSION=8.12.0-slim
FROM node:${NODE_VERSION}
ARG GITHUB_ACCOUNT=telefonicaid
ARG GITHUB_REPOSITORY=iotagent-json
ARG DOWNLOAD_TYPE=latest

ENV GITHUB_ACCOUNT=${GITHUB_ACCOUNT}
ENV GITHUB_REPOSITORY=${GITHUB_REPOSITORY}
ENV DOWNLOAD_TYPE=${DOWNLOAD_TYPE}

MAINTAINER FIWARE IoTAgent Team. Telefónica I+D

#
# The following line retrieves the latest source code from GitHub.
# 
# To obtain the latest stable release run this Docker file with the parameters
# --no-cache --build-arg DOWNLOAD_TYPE=stable
#
# Alternatively for local development, just copy this Dockerfile into file the
# root of the repository and copy over your local source using : 
#
# COPY . /opt/iotajson/
#
RUN if [ ${DOWNLOAD_TYPE} = "latest" ] ; then RELEASE="master"; else RELEASE=$(curl -s https://api.github.com/repos/${GITHUB_ACCOUNT}/${GITHUB_REPOSITORY}/releases/latest | grep 'tag_name' | cut -d\" -f4); fi && \
	if [ ${DOWNLOAD_TYPE} = "latest" ] ; then echo "INFO: Building Latest Development"; else echo "INFO: Building Release: ${RELEASE}"; fi && \
	apt-get update && \
	apt-get install -y  --no-install-recommends unzip && \
	wget --no-check-certificate -O source.zip https://github.com/${GITHUB_ACCOUNT}/${GITHUB_REPOSITORY}/archive/${RELEASE}.zip && \
	unzip source.zip && \
	rm source.zip && \
	mv ${GITHUB_REPOSITORY}-${RELEASE} /opt/iotajson && \
	apt-get clean && \
	apt-get remove -y unzip && \
	apt-get -y autoremove


WORKDIR /opt/iotajson

RUN \
	apt-get update && \
	apt-get install -y git && \
	npm install pm2@3.2.2 -g && \
	echo "INFO: npm install --production..." && \
	npm install --production && \
	# Clean apt cache
	apt-get clean && \
	apt-get remove -y git && \
	apt-get -y autoremove

USER node
ENV NODE_ENV=production

ENTRYPOINT ["pm2-runtime", "bin/iotagent-json"]
CMD ["-- ", "config.js"]
