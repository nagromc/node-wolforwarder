#! /bin/sh
# /etc/init.d/wolforwarder.sh

DAEMON_NAME=wolforwarderd
PID_FILE=/var/run/$DAEMON_NAME.pid
NODE_JS_PATH=/usr/bin/node
WOLFORWARDER_PATH=/home/morgan/dev/wolforwarder/wolforwarder.js

case "$1" in
    start)
        echo "Starting daemon: $DAEMON_NAME"
        start-stop-daemon --start --background -m --pidfile $PID_FILE --exec $NODE_JS_PATH -- $WOLFORWARDER_PATH
        ;;
    stop)
        echo "Stopping daemon: $DAEMON_NAME"
        start-stop-daemon --stop --quiet --pidfile $PID_FILE
        ;;
    restart)
        echo "Restarting daemon: $DAEMON_NAME"
        start-stop-daemon --stop --quiet --oknodo --retry 30 --pidfile $PID_FILE
        start-stop-daemon --start --quiet --pidfile $PID_FILE --exec $NODE_JS_PATH -- $WOLFORWARDER_PATH
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac

exit 0

