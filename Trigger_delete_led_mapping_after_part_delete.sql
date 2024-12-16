DELIMITER $$

CREATE TRIGGER delete_led_mapping_after_part_delete
AFTER DELETE ON parts
FOR EACH ROW
BEGIN
    DELETE FROM led_mapping
    WHERE part_id = OLD.id;
END$$

DELIMITER ;