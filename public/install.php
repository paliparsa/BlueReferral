<?php
require_once __DIR__ . '/../app/bootstrap.php';
migrate();
header('Content-Type: text/plain; charset=utf-8');
echo "BlueGate ReferralWallet Ultra tables installed / updated successfully.\n";
