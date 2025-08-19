#!/usr/bin/env bash
# Install FOSSfit Dependencies ( install_deps.sh )
#  - installs the dependencies needed to build FOSSfit
#  - these include nodejs, npm, and items listed in `package.json`
set -euo pipefail
# funcs
error_handler () {
        # simple error handler
        # - - - - - 
        local errcode=$?                # exit code of last cmd
        local cmd="$BASH_COMMAND"       # cmd that failed to run correctly
        local script=$(basename "$0")   # name of current script
        local line=$BASH_LINENO         # line number where we failed
        # - - - - -
        echo "Error detected in $script on line $line"
        echo "Command $cmd failed with exit code $errcode."
        # provide context on errors
        if [ -n "$1" ]; then
                echo "Further context: $1"
        fi
        echo "Please see logs above and try again."; sleep 1
        exit $errcode
}
trap 'error_handler' ERR
install_deps () {
	# installs node/npm and deps in package.json
	# - - - - -
	local pkgs="nodejs npm"
	# - - - - - 
	echo "Installing needed packages for FOSSfit..."; sleep 1
	doas apt update 
	doas apt install -y "$pkgs"
	# install needed stuff from devDependencies in package.json
	npm install
	echo "FOSSfit dependencies installed!"; sleep 1
	echo "If you'd like, you can now build the .deb package by running the build_deb.sh script in the /scripts folder."; sleep 1
}
main () {
	# - - - - -
	local err_installpkgs="Issue detected in package installation process."
	# - - - - -
	cd ../
	install_deps || error_handler "$err_installpkgs"
	cd scripts
}
# - - - entry
main
