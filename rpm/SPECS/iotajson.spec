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

# Only production modules
/bin/rm -fR node_modules/
npm cache clear
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
