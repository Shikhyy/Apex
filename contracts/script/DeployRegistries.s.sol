// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/IdentityRegistry.sol";
import "../src/ReputationRegistry.sol";

contract DeployRegistries is Script {
    function run() external returns (address identity, address reputation) {
        vm.startBroadcast();

        IdentityRegistry idReg = new IdentityRegistry();
        ReputationRegistry repReg = new ReputationRegistry(address(idReg));

        identity = address(idReg);
        reputation = address(repReg);

        console.log("IdentityRegistry deployed at:", identity);
        console.log("ReputationRegistry deployed at:", reputation);

        vm.stopBroadcast();
    }
}
