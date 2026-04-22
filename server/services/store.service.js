"use strict";

const { readConfig, writeConfig, mergePatch } = require("../helpers/store-io");

const read = async () => readConfig();

const write = async (patch = {}) => writeConfig(mergePatch(readConfig(), patch));

module.exports = () => ({ read, write });
