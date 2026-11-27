#!/bin/bash
# Semeia o emulador contornando as regras (token "owner"), como faria a consola
B="http://127.0.0.1:8080/v1/projects/ketshop-test/databases/(default)/documents"
put() { curl -s -X PATCH -H "Authorization: Bearer owner" -H "Content-Type: application/json" "$B/$1" -d "$2" > /dev/null; }
put categories/diamantes '{"fields":{"name":{"stringValue":"Diamantes"},"slug":{"stringValue":"diamantes"},"is_active":{"booleanValue":true},"sort_order":{"integerValue":"1"}}}'
P='"category_id":{"stringValue":"diamantes"},"game":{"stringValue":"Free Fire"},"unit_label":{"stringValue":"diamantes"},"is_on_demand":{"booleanValue":false}'
put products/p120 "{\"fields\":{$P,\"name\":{\"stringValue\":\"120 Diamantes\"},\"base_amount\":{\"integerValue\":\"100\"},\"bonus_amount\":{\"integerValue\":\"20\"},\"total_amount\":{\"integerValue\":\"120\"},\"price_kz\":{\"integerValue\":\"1050\"},\"is_active\":{\"booleanValue\":true},\"is_featured\":{\"booleanValue\":true},\"sort_order\":{\"integerValue\":\"2\"}}}"
put products/p78 "{\"fields\":{$P,\"name\":{\"stringValue\":\"78 Diamantes\"},\"base_amount\":{\"integerValue\":\"65\"},\"bonus_amount\":{\"integerValue\":\"13\"},\"total_amount\":{\"integerValue\":\"78\"},\"price_kz\":{\"integerValue\":\"700\"},\"is_active\":{\"booleanValue\":true},\"is_featured\":{\"booleanValue\":false},\"sort_order\":{\"integerValue\":\"1\"}}}"
put products/off "{\"fields\":{$P,\"name\":{\"stringValue\":\"Off\"},\"base_amount\":{\"integerValue\":\"1\"},\"bonus_amount\":{\"integerValue\":\"0\"},\"total_amount\":{\"integerValue\":\"1\"},\"price_kz\":{\"integerValue\":\"10\"},\"is_active\":{\"booleanValue\":false},\"is_featured\":{\"booleanValue\":false},\"sort_order\":{\"integerValue\":\"9\"}}}"
put paymentMethods/iban '{"fields":{"type":{"stringValue":"bank_transfer"},"name":{"stringValue":"Transferência (IBAN)"},"iban":{"stringValue":"AO06 0000 0000 0000 0000 0000 0"},"account_holder":{"stringValue":"TESTE"},"instructions":{"stringValue":"Use o código"},"is_active":{"booleanValue":true},"sort_order":{"integerValue":"1"}}}'
put paymentMethods/pp '{"fields":{"type":{"stringValue":"paypay"},"name":{"stringValue":"PayPay"},"is_active":{"booleanValue":false},"sort_order":{"integerValue":"2"}}}'
put settings/public '{"fields":{"store_name":{"stringValue":"KET SHOP"},"maintenance_mode":{"booleanValue":false}}}'
