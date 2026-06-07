param($Bytes = 32)

$size = [int]"$Bytes"
$buf = [byte[]]::new($size)
[System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes($buf)
[Convert]::ToBase64String($buf)
