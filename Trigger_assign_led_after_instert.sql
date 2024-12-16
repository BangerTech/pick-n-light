DELIMITER $$

CREATE TRIGGER assign_led_after_insert
AFTER INSERT ON parts
FOR EACH ROW
BEGIN
    DECLARE next_led_position INT;

    -- Nächste verfügbare LED-Position finden
    SELECT COALESCE(MAX(led_position), 0) + 1 INTO next_led_position FROM led_mapping;

    -- Neue Zuordnung in die Tabelle led_mapping einfügen
    INSERT INTO led_mapping (part_id, led_position)
    VALUES (NEW.id, next_led_position);
END$$

DELIMITER ;