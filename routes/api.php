<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::redirect('/', 'https://github.com/benborgers/opensheet#readme');

Route::get('{id}/{sheet}', function ($id, $sheet) {
    return 'Hello world!';
});

Route::get('{any}', function () {
    return response()->json([
        'error' => 'URL format is /spreadsheet_id/sheet_name'
    ], 404);
})->where('any', '.*');
