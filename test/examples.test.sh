#!/usr/bin/env bash
#
# examples.test.sh: Bash tests for example scripts
#
# (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
# MIT LICENSE
#

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXAMPLES_DIR="$PROJECT_ROOT/examples"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Test helper: run example and check exit code
run_example() {
  local name="$1"
  local expected_exit="${2:-0}"
  local file="$EXAMPLES_DIR/$name.js"

  if [[ ! -f "$file" ]]; then
    echo -e "${RED}FAIL${NC}: $name - file not found"
    ((FAILED++))
    return 1
  fi

  echo -n "Testing $name... "

  # Capture output and exit code
  local output
  local exit_code=0
  output=$(node "$file" 2>&1) || exit_code=$?

  if [[ "$expected_exit" == "nonzero" && "$exit_code" -ne 0 ]]; then
    echo -e "${GREEN}PASS${NC} (exit $exit_code, expected non-zero)"
    ((PASSED++))
    return 0
  elif [[ "$expected_exit" == "0" && "$exit_code" -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
    return 0
  elif [[ "$expected_exit" == "$exit_code" ]]; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}FAIL${NC} (exit $exit_code, expected $expected_exit)"
    echo "Output:"
    echo "$output" | head -20
    ((FAILED++))
    return 1
  fi
}

# Test helper: run example and check output contains string
run_example_check_output() {
  local name="$1"
  local expected_string="$2"
  local file="$EXAMPLES_DIR/$name.js"

  if [[ ! -f "$file" ]]; then
    echo -e "${RED}FAIL${NC}: $name - file not found"
    ((FAILED++))
    return 1
  fi

  echo -n "Testing $name (checking output)... "

  # Capture output
  local output
  local exit_code=0
  output=$(node "$file" 2>&1) || exit_code=$?

  if echo "$output" | grep -q "$expected_string"; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}FAIL${NC} (expected output to contain: $expected_string)"
    echo "Output:"
    echo "$output" | head -20
    ((FAILED++))
    return 1
  fi
}

echo "Running example tests..."
echo "========================"
echo ""

# boundary.js - should run successfully with validation errors collected
run_example_check_output "boundary" "Collected 3 validation errors"

# custom-error.js - should register and create custom error
run_example_check_output "custom-error" "MyError"

# stack.js - should show transparent stack trace
run_example_check_output "stack" "Transparent stack trace"

# async-uncaught-exception.js - handles uncaught exception gracefully
run_example_check_output "async-uncaught-exception" "Formatted output"

# sync-uncaught-exception.js - handles uncaught exception gracefully
run_example_check_output "sync-uncaught-exception" "Caught exception"

# handling-streams.js - handles stream errors gracefully
run_example_check_output "handling-streams" "Stream error handled"

echo ""
echo "========================"
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"

if [[ "$FAILED" -gt 0 ]]; then
  exit 1
fi
