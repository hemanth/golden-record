<?php
$action = isset($_GET['action']) ? (string)$_GET['action'] : '';

header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('content-signal: ai-train=yes, search=yes, ai-input=yes');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($action === 'markdown') {
    $mdBody = @file_get_contents(__DIR__ . '/llms.txt');
    if (!$mdBody) {
        $mdBody = "# Voyager Golden Record (1977)\n\nInteractive 3D 24k Gold NASA Voyager Golden Record.\n";
    }
    $htmlRaw = @file_get_contents(__DIR__ . '/index.html');
    if (!$htmlRaw) $htmlRaw = '';
    $frontmatter = "---\n"
        . "title: \"Voyager Golden Record · 3D 24k Gold Disc & Sounds of Earth (1977)\"\n"
        . "description: \"Interactive 3D NASA Voyager Golden Record at 16 2/3 RPM with real-life stylus cueing, platter physics, all 27 musical works across 19 countries, 55 Greetings, and 19 Sounds of Earth.\"\n"
        . "url: \"https://h3manth.com/fun/golden-record/\"\n"
        . "---\n\n";
    $fullMd = $frontmatter . $mdBody;
    header('Content-Type: text/markdown; charset=utf-8');
    header('Vary: Accept');
    header('x-markdown-tokens: ' . (string)(int)ceil(strlen($fullMd) / 4));
    if ($htmlRaw !== '') {
        header('x-original-tokens: ' . (string)(int)ceil(strlen($htmlRaw) / 4));
    }
    echo $fullMd;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$rawJson = @file_get_contents(__DIR__ . '/data/golden-record.json');
$data = $rawJson ? json_decode($rawJson, true) : null;
if (!$data || !isset($data['tracks'])) {
    http_response_code(500);
    echo json_encode(array('error' => 'Dataset unavailable'));
    exit;
}

if ($action === 'stats') {
    echo json_encode($data['meta'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

if ($action === 'diagrams') {
    echo json_encode(array(
        'count' => count($data['coverDiagrams']),
        'diagrams' => $data['coverDiagrams']
    ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

if ($action === 'track') {
    $id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
    if ($id === '') {
        http_response_code(400);
        echo json_encode(array('error' => 'Provide ?id=<groove-id-or-code>'));
        exit;
    }
    $needle = strtolower($id);
    foreach ($data['tracks'] as $track) {
        $tid = isset($track['id']) ? strtolower((string)$track['id']) : '';
        $tcode = isset($track['code']) ? strtolower((string)$track['code']) : '';
        if ($tid === $needle || $tcode === $needle) {
            echo json_encode($track, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
            exit;
        }
    }
    http_response_code(404);
    echo json_encode(array('error' => 'Groove not found', 'id' => $id));
    exit;
}

if ($action === 'tracks') {
    $q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
    $side = isset($_GET['side']) ? strtolower(trim((string)$_GET['side'])) : 'all';
    $country = isset($_GET['country']) ? trim((string)$_GET['country']) : '';
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 48;
    if ($limit < 1) $limit = 1;
    if ($limit > 48) $limit = 48;

    $qLower = mb_strtolower($q, 'UTF-8');
    $cLower = mb_strtolower($country, 'UTF-8');
    $results = array();

    foreach ($data['tracks'] as $t) {
        if (($side === 'music' || $side === 'sounds') && (!isset($t['side']) || $t['side'] !== $side)) {
            continue;
        }
        if ($cLower !== '') {
            $tc = isset($t['country']) ? mb_strtolower((string)$t['country'], 'UTF-8') : '';
            if (mb_strpos($tc, $cLower) === false) continue;
        }
        if ($qLower !== '') {
            $hay = mb_strtolower(
                (isset($t['id']) ? $t['id'] : '') . ' ' .
                (isset($t['code']) ? $t['code'] : '') . ' ' .
                (isset($t['title']) ? $t['title'] : '') . ' ' .
                (isset($t['country']) ? $t['country'] : '') . ' ' .
                (isset($t['artist']) ? $t['artist'] : '') . ' ' .
                (isset($t['summary']) ? $t['summary'] : ''),
                'UTF-8'
            );
            if (mb_strpos($hay, $qLower) === false) continue;
        }
        $results[] = $t;
        if (count($results) >= $limit) break;
    }

    echo json_encode(array(
        'query' => $q,
        'side' => $side,
        'country' => $country,
        'count' => count($results),
        'results' => $results
    ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

http_response_code(400);
echo json_encode(array(
    'error' => 'Supported actions: tracks, track, diagrams, stats, markdown',
    'openapi' => 'https://h3manth.com/fun/golden-record/openapi.json'
), JSON_UNESCAPED_SLASHES);
