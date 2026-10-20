"""Independent stdlib check of the generated OPC/SpreadsheetML package.

Receives XLSX bytes on stdin; emits decoded sheet rows as JSON on stdout.
"""
import io
import json
import posixpath
import re
import struct
import sys
import zipfile
import xml.etree.ElementTree as ET


MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"


def tag(element):
    return element.tag.rsplit("}", 1)[-1]


def check_relation_file(archive, name, base):
    root = ET.fromstring(archive.read(name))
    assert root.tag == "{%s}Relationships" % PKG_REL
    result = {}
    for entry in root:
        assert entry.tag == "{%s}Relationship" % PKG_REL
        identifier = entry.attrib["Id"]
        assert identifier not in result
        target = posixpath.normpath(posixpath.join(base, entry.attrib["Target"]))
        assert target in archive.namelist(), (name, target)
        result[identifier] = (entry.attrib["Type"], target)
    return result


def numeric(value):
    number = float(value)
    return int(number) if number.is_integer() else number


def run(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        assert archive.testzip() is None, "ZIP CRC mismatch"
        names = archive.namelist()
        assert len(names) == len(set(names)), "Duplicate ZIP entry"
        types = ET.fromstring(archive.read("[Content_Types].xml"))
        assert types.tag == "{%s}Types" % CT
        defaults = {entry.attrib["Extension"]: entry.attrib["ContentType"] for entry in types if tag(entry) == "Default"}
        overrides = {entry.attrib["PartName"].lstrip("/"): entry.attrib["ContentType"] for entry in types if tag(entry) == "Override"}
        assert defaults["rels"] == "application/vnd.openxmlformats-package.relationships+xml"
        assert defaults["xml"] == "application/xml"
        for name in names:
            if name == "[Content_Types].xml":
                continue
            assert name in overrides or name.rsplit(".", 1)[-1] in defaults, name
        assert overrides["xl/workbook.xml"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
        assert overrides["xl/styles.xml"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"
        package_rel = check_relation_file(archive, "_rels/.rels", "")
        assert any(target == "xl/workbook.xml" for _, target in package_rel.values())
        workbook_rel = check_relation_file(archive, "xl/_rels/workbook.xml.rels", "xl")
        assert any(target == "xl/styles.xml" for _, target in workbook_rel.values())
        styles = ET.fromstring(archive.read("xl/styles.xml"))
        cell_xfs = styles.find("{%s}cellXfs" % MAIN)
        assert cell_xfs is not None and int(cell_xfs.attrib["count"]) == len(cell_xfs) >= 1
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheets = workbook.find("{%s}sheets" % MAIN)
        assert sheets is not None
        seen = set()
        decoded = {}
        for sheet in sheets:
            name = sheet.attrib["name"]
            assert 1 <= len(name) <= 31 and not re.search(r"[\[\]:*?/\\]", name)
            assert name.casefold() not in seen
            seen.add(name.casefold())
            sheet_rel = workbook_rel[sheet.attrib["{%s}id" % REL]]
            assert sheet_rel[0].endswith("/worksheet")
            part = sheet_rel[1]
            assert overrides[part] == "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
            root = ET.fromstring(archive.read(part))
            assert [tag(child) for child in root] == ["dimension", "sheetViews", "sheetFormatPr", "cols", "sheetData"]
            rows = []
            max_column = 1
            for row in root.find("{%s}sheetData" % MAIN):
                values = []
                for cell in row:
                    index = 0
                    for letter in re.match(r"[A-Z]+", cell.attrib["r"]).group():
                        index = index * 26 + ord(letter) - 64
                    max_column = max(max_column, index)
                    assert int(cell.attrib.get("s", "0")) < len(cell_xfs)
                    assert cell.find("{%s}f" % MAIN) is None, "Unexpected formula cell"
                    if cell.attrib.get("t") == "inlineStr":
                        value = "".join(cell.itertext())
                    else:
                        assert cell.attrib.get("t") in (None, "n")
                        number = cell.find("{%s}v" % MAIN)
                        assert number is not None
                        value = numeric(number.text)
                    while len(values) < index - 1:
                        values.append("")
                    values.append(value)
                rows.append(values)
            ref = root.find("{%s}dimension" % MAIN).attrib["ref"]
            column = ""
            while max_column:
                max_column, digit = divmod(max_column - 1, 26)
                column = chr(65 + digit) + column
            assert ref == f"A1:{column}{max(1, len(rows))}", (name, ref)
            decoded[name] = rows
        for info in archive.infolist():
            assert info.date_time == (1980, 1, 1, 0, 0, 0), (info.filename, info.date_time)
            (signature, _version, flags, method, _time, date, crc, compressed, plain, length, extra) = struct.unpack_from("<IHHHHHIIIHH", raw, info.header_offset)
            assert signature == 0x04034B50 and flags == info.flag_bits and method == info.compress_type
            assert date == 0x21 and crc == info.CRC and compressed == info.compress_size and plain == info.file_size
            assert raw[info.header_offset + 30:info.header_offset + 30 + length].decode() == info.filename
            assert extra == 0
        return decoded


if __name__ == "__main__":
    try:
        with open(sys.argv[1], "rb") if len(sys.argv) > 1 else sys.stdin.buffer as stream:
            print(json.dumps(run(stream.read()), ensure_ascii=False))
    except Exception as error:
        print(f"OPC validation failed: {error}", file=sys.stderr)
        sys.exit(1)
