Summary: JSON IoT Agent
Name: iotagent-json
Version: %{_product_version}
Release: %{_product_release}
License: AGPLv3
BuildRoot: %{_topdir}/BUILDROOT/
BuildArch: x86_64
# Requires: nodejs >= 0.10.24
Requires: logrotate
Requires(post): /sbin/chkconfig, /usr/sbin/useradd npm
Requires(preun): /sbin/chkconfig, /sbin/service
Requires(postun): /sbin/service
Group: Applications/Engineering
Vendor: Telefonica I+D

%description
JSON IoT Agent is a bridge between a JSON+MQTT based protocol and the NGSI protocol used internally by
Telefonica's IoT Platform and FIWARE.

# System folders
%define _srcdir $RPM_BUILD_ROOT/../../..
%define _service_name iotajson
%define _install_dir /opt/iotajson
%define _iotajson_log_dir /var/log/iotajson
%define _iotajson_pid_dir /var/run/iotajson
%define _iotajson_conf_dir /etc/iotajson.d

%define _iotajson_executable iotagent-json

# RPM Building folder
%define _build_root_project %{buildroot}%{_install_dir}
# -------------------------------------------------------------------------------------------- #
# prep section, setup macro:
# -------------------------------------------------------------------------------------------- #
%prep
echo "[INFO] Preparing installation"
# Create rpm/BUILDROOT folder
/bin/rm -Rf $RPM_BUILD_ROOT && /bin/mkdir -p $RPM_BUILD_ROOT
[ -d %{_build_root_project} ] || /bin/mkdir -p %{_build_root_project}

# Copy src files
/bin/cp -R %{_srcdir}/lib \
      %{_srcdir}/bin \
      %{_srcdir}/config.js \
      %{_srcdir}/package.json \
      %{_srcdir}/LICENSE \
      %{_build_root_project}

[ -f %{_srcdir}/npm-shrinkwrap.json ] && /bin/cp %{_srcdir}/npm-shrinkwrap.json %{_build_root_project}

/bin/cp -R %{_topdir}/SOURCES/etc %{buildroot}

# -------------------------------------------------------------------------------------------- #
# Build section:
# -------------------------------------------------------------------------------------------- #
%build
echo "[INFO] Building RPM"
cd %{_build_root_project}

# Only production modules. We have found that --force is required to make this work for Node v8
/bin/rm -fR node_modules/
npm cache clear --force
npm install --production

# -------------------------------------------------------------------------------------------- #
# pre-install section:
# -------------------------------------------------------------------------------------------- #
%pre
echo "[INFO] Creating %{_project_user} user"
grep ^%{_project_user}: /etc/passwd
RET_VAL=$?
if [ "$RET_VAL" != "0" ]; then
      /usr/sbin/useradd -s "/bin/bash" -d %{_install_dir} %{_project_user}
      RET_VAL=$?
      if [ "$RET_VAL" != "0" ]; then
         echo "[ERROR] Unable create %{_project_user} user" \
         exit $RET_VAL
      fi
else
      /bin/mv %{_install_dir}/config.js /tmp
fi

# -------------------------------------------------------------------------------------------- #
# post-install section:
# -------------------------------------------------------------------------------------------- #
%post
echo "[INFO] Configuring application"
    echo "[INFO] Creating the home JSON IoT Agent directory"
    /bin/mkdir -p _install_dir
    echo "[INFO] Creating log & run directory"
    /bin/mkdir -p %{_iotajson_log_dir}
    chown -R %{_project_user}:%{_project_user} %{_iotajson_log_dir}
    chown -R %{_project_user}:%{_project_user} _install_dir
    chmod g+s %{_iotajson_log_dir}
    setfacl -d -m g::rwx %{_iotajson_log_dir}
    setfacl -d -m o::rx %{_iotajson_log_dir}

    /bin/mkdir -p %{_iotajson_pid_dir}
    chown -R %{_project_user}:%{_project_user} %{_iotajson_pid_dir}
    chown -R %{_project_user}:%{_project_user} _install_dir
    chmod g+s %{_iotajson_pid_dir}
    setfacl -d -m g::rwx %{_iotajson_pid_dir}
    setfacl -d -m o::rx %{_iotajson_pid_dir}

    echo "[INFO] Configuring application service"
    cd /etc/init.d
    chkconfig --add %{_service_name}

    # restores old configuration if any
    [ -f /tmp/config.js ] && /bin/mv /tmp/config.js %{_install_dir}/config.js
   
    # Chmod iotagent-json binary
    chmod guo+x %{_install_dir}/bin/%{_iotajson_executable}

echo "Done"

# -------------------------------------------------------------------------------------------- #
# pre-uninstall section:
# -------------------------------------------------------------------------------------------- #
%preun

echo "[INFO] stoping service %{_service_name}"
service %{_service_name} stop &> /dev/null

if [ $1 == 0 ]; then

  echo "[INFO] Removing application log files"
  # Log
  [ -d %{_iotajson_log_dir} ] && /bin/rm -rf %{_iotajson_log_dir}

  echo "[INFO] Removing application run files"
  # Log
  [ -d %{_iotajson_pid_dir} ] && /bin/rm -rf %{_iotajson_pid_dir}

  echo "[INFO] Removing application files"
  # Installed files
  [ -d %{_install_dir} ] && /bin/rm -rf %{_install_dir}

  echo "[INFO] Removing application user"
  userdel -fr %{_project_user}

  echo "[INFO] Removing application service"
  chkconfig --del %{_service_name}
  /bin/rm -Rf /etc/init.d/%{_service_name}
  echo "Done"
fi

# -------------------------------------------------------------------------------------------- #
# post-uninstall section:
# clean section:
# -------------------------------------------------------------------------------------------- #
%postun
%clean
/bin/rm -rf $RPM_BUILD_ROOT

# -------------------------------------------------------------------------------------------- #
# Files to add to the RPM
# -------------------------------------------------------------------------------------------- #
%files
%defattr(644,%{_project_user},%{_project_user},755)
%config /etc/init.d/%{_service_name}
%attr(755, root, root) /etc/init.d/%{_service_name}
%config /etc/init.d/%{_service_name}
%config /etc/iotajson.d/iotajson.default.conf
%config /etc/logrotate.d/logrotate-%{_service_name}.conf
%config /etc/cron.d/cron-logrotate-%{_service_name}-size
%config /etc/sysconfig/logrotate-%{_service_name}-size
%config /etc/sysconfig/iotajson.conf
%{_install_dir}

%changelog
* Mon Feb 7 2022 Alvaro Vega <alvaro.vegagarcia@telefonica.com> 1.21.0
- Add: allow to handle binary messages
- Fix: pass parsedMessage (string not raw) to singleMeasure handler 
- Fix: default mqtt keepalive value by conf (must be 60 instead of 0) (iota-ul#527)
- Fix: provide device type to findConfiguration to achieve a better group match in getEffectiveApiKey (iota-node-lib#1155)
- Fix: update polling when device is updated by adding endpoint (needs iota-node-lib >= 2.19) (#602)
- Fix: remove preprocess stripping of explicitAttrs (iotagent-node-lib#1151)
- Fix: add graceful shutdown listening to SIGINT (#606)
- Fix: remove request obsolete library, using iotagent-node-lib.request instead (iotagent-node-lib#858)
- Upgrade logops dep from 2.1.0 to 2.1.2 due to colors dependency corruption
- Upgrade iotagent-node-lib dependency from 2.18.0 to 2.19.0

* Fri Nov 12 2021 Alvaro Vega <alvaro.vegagarcia@telefonica.com> 1.20.0
- Fix service and subservice to 'n/a' when apikey from measure is not found (needs iota-node-lib => 2.18) (#587)
- Remove: NGSI-v1 specific behaviours (iotagent-lib#966)
- Upgrade iotagent-node-lib dependency from 2.17.0 to 2.18.0

* Mon Aug 30 2021 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.19.0
- Add: custom JEXL transformations from config file (iotagent-node-lib#1056)
- Fix: content-type for get command in base of accept header (#582)
- Fix: processing configurations subscriptions in NGSIv2 (#563)
- Fix: check access to active attribute of device before use it (#576)
- Upgrade iotagent-node-lib dependency from 2.16.0 to 2.17.0
- Remove: obsolete Thinking Things plugin (#573)

* Fri Jun 18 2021 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.18.0
- Add: MQTT options `clean` and `clientId` (env vars IOTA_MQTT_CLEAN and IOTA_MQTT_CLIENT_ID) (#414, #466, #497)
- Add: list of environment variables which can be protected by Docker Secrets
- Fix: check autoprovision flag before register device
- Fix: missing content-type: application/json header in the request sent to device command endpoint (HTTP transport)
- Fix: avoid raise mongo alarm when a measure is not maching a group configuration
- Upgrade underscore dependency from 1.9.1 to 1.12.1 due to vulnerability
- Upgrade iotagent-node-lib dependency from 2.15.0 to 2.16.0
- Upgrade NodeJS version from 10 to 12 in Dockerfile due to Node 10 End-of-Life
- Set Nodejs 12 as minimum version in packages.json (effectively removing Nodev10 from supported versions)

* Thu Feb 18 2021 Alvaro Vega <alvaro.vegagarcia@telefonica.com> 1.17.0
- Add: Support of multimeasure for MQTT and AMQP transport (#462)
- Fix: Set 60 seconds for default mqtt keepalive option (#413)
- Upgrade iotagent-node-lib dependency from 2.14.0 to 2.15.0

* Mon Nov 16 2020 Alvaro Vega <alvaro.vegagarcia@telefonica.com> 1.16.0
- Add: use mqtt.qos and mqtt.retain values from command for command execution (#504)
- Add: log in info level command and configuration MQTT
- FIX: check ngsi version in configuration handler (#500)
- Add missed global config env vars (IOTA_CONFIG_RETRIEVAL, IOTA_DEFAULT_KEY, IOTA_DEFAULT_TRANSPORT)
- Upgrade iotagent-node-lib dependency from 2.13.0 to 2.14.0
- Update Docker security practices (Add HEALTHCHECK, Use Anonymous User, Use two-stage build)

* Mon Sep 14 2020 Alvaro Vega <alvaro.vegagarcia@telefonica.com> 1.15.0
- Add: config.mqtt.avoidLeadingSlash flag (IOTA_MQTT_AVOID_LEADING_SLASH) to avoid leading slash in MQTT
- Add: explicitAttrs flag (in configuration and also group/device provisioning) to progress only the measures corresponding to attributes declared in attributes array (#416)
- Fix: force finish transaction after process a device measure
- Fix: do not intercept error about DEVICE_NOT_FOUND in findOrCreate device (iotagent-node-lib#889)
- Fix: srv, subsrv, transaction and correlator id in logs of http binding
- Fix: some log levels and details at bindings
- Fix: writing of same correlator and transaction id in logs (#426).
- Fix: error processing zero measures (#486)
- Update codebase to use ES6
  -  Remove JSHint and jshint overrides
  -  Add esLint using standard tamia presets
  -  Replace var with let/const
  -  Fix or disable eslint errors
- Upgrade iotagent-node-lib dependency from 2.12.0 to 2.13.0
- Overall update of dev package dependencies
- Set Nodejs 10 as minimum version in packages.json (effectively removing Nodev8 from supported versions)

* Tue Apr 07 2020 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.14.0
- Add: multimeasure support for HTTP transport (#391, partially)
- Add: check response obj before use it handling http commands
- Add: southbound HTTPS support (#472)
- Fix: move to warn error log about device not found
- Upgrade iotagent-node-lib dependency from 2.11.0 to 2.12.0
- Upgrade NodeJS version from 8.16.1 to 10.19.0 in Dockerfile due to Node 8 End-of-Life

* Wed Nov 20 2019 Alvaro Vega <alvaro.vegagarcia@telefonica.com> 1.13.0
- Allow use protocol ("/json") in mqtt topics subscribed by the agent (#374)
- Use MQTT v5 shared subscriptions to avoid dupplicated messages per agent type (upgrade mqtt dep from 2.18.8 to 3.0.0). Needs MQTT v5 broker like mosquitto 1.6+
- Use AMQP durable option in assertExchange
- Use device apikey if exists in getEffectiveApiKey for command handling

* Mon Nov 04 2019 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.12.0
- Add: PM2_ENABLED flag to Docker
- Fix: update default expiration device registration (ngsiv1) from 1M to 20Y
- Fix: avoid connections to AMQP and MQTT when these transports are not included in configuration (#409)
- Fix: check callback before use it if MQTT connection error
- Upgrade iotagent-node-lib dependency from 2.10.0 to 2.11.0 (inclusing NGSIv2 forwarding -issue #250-, and cluster nodejs functionality)
- Upgrade NodeJS version from 8.16.0 to 8.16.1 in Dockerfile due to security issues

* Tue Aug 13 2019 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.11.0
- Set Nodejs 8 as minimum version in packages.json (effectively removing Nodev6 from supported versions)
- Add: Reconnect when MQTT closes connection (including mqtt retries and keepalive conf options)
- Upgrade iotagent-node-lib dependency from 2.9.0 to 2.10.0

* Wed May 22 2019 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.10.0
- Set Nodejs 6 version in packages.json (effectively removing Nodev4 as supported version)
- Add: config.http.timeout (and associated enviroment variable IOTA_HTTP_TIMEOUT)(#152)
- Add: config.mqtt.{cert,key,protocol,rejectUnauthorized} (and associated environment variables IOTA_MQTT_*)(#372)
- Add: readding sinon as dev dependency (~6.1.0)
- Upgrade NodeJS version from 8.12.0 to 8.16.0 in Dockerfile to improve security
- Upgrade logops dependency from 1.0.8 to 2.1.0
- Upgrade iotagent-node-lib dependency from 2.8.1 to 2.9.0

* Wed Dec 19 2018 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.9.0
- Add: use timestamp configuration from group device
- Add: use AMQP message handler, add reconnections and error handlers
- Add: AMQP config env vars (#297)
- Add: npm scripts to execute tests, coverage, watch and clean
- Add: use NodeJS 8 in Dockerfile
- Add: use PM2 in Dockerfile (#336)
- Fix: AMQP callback over-calling
- Fix: check QoS option for MQTT commands
- Fix: check retain option for MQTT commands
- Upgrade: iotagent-node-lib dependence from 2.7.x to 2.8.1
- Upgrade: mqtt dependence from 1.14.1 to 2.18.8
- Upgrade: update logops dependence from 1.0.0-alpha.7 to 1.0.8
- Upgrade: async dependence from 1.5.2 to 2.6.1
- Upgrade: body-parser dependence from 1.15.0 to 1.18.3
- Upgrade: express dependence from ~4.11.2 to ~4.16.4
- Upgrade: request dependence from 2.81.0 to 2.88.0
- Upgrade: underscore dependence from 1.8.3 to 1.9.1
- Upgrade: dateformat dependence from 1.0.12 to 3.0.3
- Upgrade: nock development dependence from 9.0.14 to 10.0.1
- Upgrade: mocha development dependence from 2.4.5 to 5.2.0
- Upgrade: should development dependence from 8.4.0 to 13.2.3
- Upgrade: istanbul development dependence from ~0.1.34 to ~0.4.5
- Upgrade: proxyquire development dependence from 1.7.9 to 2.1.0
- Upgrade: moment development dependence from ~2.20.1 to ~2.22.2
- Remove: old unused development dependencies (closure-linter-wrapper, sinon-chai, sinon, chai, grunt and grunt related modules)

* Mon Aug 06 2018 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.8.0
- Update ioagent-node-lib to 2.7.x
- Add: allow NGSIv2 for updating active attributes at CB, through configuration based on iotagent-node-lib (#250)
- Add: measures are sent in native JSON format when NGSIv2 is enabled (#250)
- Add: supports NGSIv2 for device provisioning (entity creation and context registration) at CB (#250)
- Add: unhardwire MQTT qos and retain parameters in config.js (involving new env vars IOTA_MQTT_QOS and IOTA_MQTT_RETAIN) (#279)
- Add: momment dep to packages.json
- Fix: parameter order for the MEASURE-001 error message (#290)
- Fix: upgrade mqtt dep from 1.7.0 to 1.14.1
- Using precise dependencies (~=) in packages.json
- Remove mongodb dependence from packages.json (already in iota-node-lib)

* Mon Feb 26 2018 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.7.0
- Update ioagent-node-lib to 2.6.x
- Allow get list of commands without sending measures (empty payload) (#256)
- Fix: typo in logger level of ApiKey configuration (#247)
- Fix: transport in autoprovision device depending on binding (#257)
- Fix: defaultKey in config.js (supposely fixing #222 and #207)
- Fix: default resource /iot/json instead of /iot/d in config and tests

* Wed Oct 18 2017 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.6.0
- FEATURE update node version to 4.8.4
- Update MongoDB driver in order to fix NODE-818 error (#226)

* Fri Nov 10 2016 Daniel Moran <daniel.moranjimenez@telefonica.com> 1.5.0
- Add multientity, bidirectionality and expression plugins (#184)
- FIX Transformed data should include Metadata field (#190)
- FIX TimeInstant in measure update makes null time update in CB (#192)
- Poll commands not working (#194)
- FIX IoTA JSON Timestamp parameter in measure request is ignored (#195)
- FIX Error in http json push commands (#197)
- FIX Missing context in logger entries (#198)
- ADD Alarms for the Mosquitto server (#205)
- ADD Iota Json retrieve is not working (#208)

* Fri Sep 09 2016 Daniel Moran <daniel.moranjimenez@telefonica.com> 1.4.0
- Autoprovisioned devices omit mapped attributes (#160)
- ADD Operations manual
- Logger modules not being singleton cause logging inconsistencies (#173)
- [Documentation] Reference to /iot/d instead of /iot/json (#168)
