## Functional test suite

This directory contains the functional test suite for the project. This relies on the IoT Agent Node Lib Functional test
suite. For further information, visit the
[documentation](https://github.com/telefonicaid/iotagent-node-lib/tree/master/test/functional).

The `functional-tests-runner.js` script is used to run the functional test suite. It is similar to the one used in the
IoT Agent Node Lib, but it has been adapted to the particularities of the IoT Agent JSON. This script imports both the
IoT Agent Node Lib `testCases.js` and the local `testCases.js` file. The latter contains the test cases that are
specific to the IoT Agent JSON, while the former contains the test cases that are common to all IoT Agents.

If you plan to include a tests for an specific feature of the IoT Agent JSON, please, consider added it into the IoTA
Node Lib `testCases.js` file and use the skip feature to avoid running it for other agents that do not support it. You
can check the documentation of the IoT Agent Node Lib Functional test suite linked previously for further information.

Additionally, the `functional-tests.js` file is a simple example of how to implement code bases tests using the IoT
Agent Node Lib Functional test suite utilities. (This test is coded implemented and suites more complex cases than the
ones contained in the `testCases.js` file).
