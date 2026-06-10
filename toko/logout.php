<?php
require_once __DIR__ . '/lib.php';
admin_logout();
header('Location: login.php');
exit;
