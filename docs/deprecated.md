# Deprecated functionality

Deprecated features are features that iotagent-json stills support but that are
not maintained or evolved any longer. In particular:

-   Bugs or issues related with deprecated features and not affecting
    any other feature are not addressed (they are closed in github.com
    as soon as they are spotted).
-   Documentation on deprecated features is removed from the repository documentation.
    Documentation is still available in the documentation set associated to older versions
    (in the repository release branches).
-   Deprecated functionality is eventually removed from iotagent-json. Thus you
    are strongly encouraged to change your implementations using iotagent-json
    in order not rely on deprecated functionality.

A list of deprecated features and the version in which they were deprecated follows:

* Support to NGSIv1.
* Support to Node.js v4 in iotagent-json 1.9.0. The use of Node.js v8 is highly recommended.

## Using old iotagent-json versions

Although you are encouraged to use always the newest iotagent-json version, take into account the following
information in the case you want to use old versions:

* Code corresponding to old releases is available at the [iotagent-json github repository](https://github.com/telefonicaid/iotagent-json). Each release number
  (e.g. 1.8.0 ) has associated the following:
	* A tag, e.g. `1.8.0 `. It points to the base version.
	* A release branch, `release/1.8.0 `. The HEAD of this branch usually matches the aforementioned tag. However, if some
    hotfixes were developed on the base version, this branch contains such hotfixes.
* Documentation corresponding to old versions can be found at [readthedocs.io](https://fiware-iotagent-json.readthedocs.io). Use the panel in the right bottom corner to navigate to the right version.
    
* Docker images corresponding to iotagent-json can be found at [Dockerhub](https://hub.docker.com/r/fiware/iotagent-json/tags/).

The following table provides information about the last iotagent-json version supporting currently removed features:

| **Removed feature**                                                        | **Last iotagent-json version supporting feature** | **That version release date**   |
|----------------------------------------------------------------------------|-------------------------------------------|---------------------------------|
| NGSIv1 API                               | Not yet defined                 | Not yet defined
| Support to Node.js v6                    |  Not yet defined but it will be done by May 2019                  | Not yet defined            
| Support to Node.js v4                    | 1.9.0                           | December 19th, 2018             |
