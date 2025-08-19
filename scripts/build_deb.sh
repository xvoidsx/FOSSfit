#!/usr/bin/env bash
# FOSSfit Builder
#  - builds and installs our FOSSfit .deb package
set -euo pipefail
deb_location="dist/fossfit*.deb"
# funcs
error_handler () {
	# simple error handler
	# - - - - - 
	local errcode=$?		# exit code of last cmd
	local cmd="$BASH_COMMAND"	# cmd that failed to run correctly
	local script=$(basename "$0")	# name of current script
	local line=$BASH_LINENO		# line number where we failed
	# - - - - -
	echo "Error detected in $script on line $line"
	echo "Command $cmd failed with exit code $errcode."
	if [ -n "$1" ]; then
		echo "Further context: $1"
	fi
	echo "Please see logs above and try again."; sleep 1
	exit $errcode
}
trap 'error_handler' ERR
main () {
	# build the FOSSfit .deb pkg and install it
	# - - - - -
	local err_electronbuild="Issue detected in the 'electron-build' process."
	local err_debinstall="Issue detected in the Debian package installation process."
	# - - - - -
	echo "Building and installing FOSSfit .deb package..."; sleep 1
	cd ../
	npm run dist || echo "$err_electronbuild"
	doas dpkg -i $deb_location || echo "$err_debinstall"
	echo "FOSSfit .deb package has been built and installed."; sleep 1
}
# - - - entry
main
