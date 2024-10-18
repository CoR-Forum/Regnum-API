<?php

Class GlobalFunctions {
    public function getMissingParams($data, $requiredParams) {
        $missingParams = [];
        foreach ($requiredParams as $param) {
            if (!isset($data[$param])) {
                $missingParams[] = $param;
            }
        }
        return $missingParams;
    }

    public function getCurrentStatus() {
        return "Current status: All systems operational.";
    }
}