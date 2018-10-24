FROM node:8.12.0-slim

MAINTAINER FIWARE IoTAgent Team. TelefÃ³nica I+D

COPY . /opt/iotajson/
WORKDIR /opt/iotajson

RUN \
  apt-get update && \
  apt-get install -y git && \
  npm install -g grunt-cli && \
  echo "INFO: npm install --production..." && \
  cd /opt/iotajson && npm install --production && \
  # Clean apt cache
  apt-get clean && \
  apt-get remove -y git && \
  apt-get -y autoremove

RUN npm install pm2@latest -g
USER node
ENV NODE_ENV=production
CMD ["pm2-runtime", "bin/iotagent-json", "config.js"]
